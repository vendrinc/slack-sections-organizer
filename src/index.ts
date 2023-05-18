import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import * as dotenv from 'dotenv';

import fetch from 'node-fetch';

const FormData = require("form-data")
const readlineSync = require("readline-sync")

dotenv.config();

const optionDefinitions = [
  { 
    name: 'group-handle',
    alias: 'g',
    type: String,
    multiple: true,
    description: 'User group handles. Create and organize sections for the named user groups.',
  },
  {
    name: 'group-desc-tag',
    alias: 't',
    type: String,
    multiple: true,
    description: 'User group description tag. Create and organize sections for all user groups containing one or more tags in the description.',
  },
  {
    name: 'join-channels',
    alias: 'j',
    type: Boolean,
    defaultValue: true,
    description: 'Join all channels in the user groups',
  },
  {
    name: 'delete-empty-sections',
    alias: 'd',
    type: Boolean,
    defaultValue: true,
    description: 'Delete empty sections after completing organization'
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Display help information'
  }
];

const options = commandLineArgs(optionDefinitions)
const usage = commandLineUsage([
  {
    header: "Slack Sections Organizer",
    content: "This tool creates Slack sections to mirror your team's user groups and default channels."
  },
  {
    header: "Options",
    optionList: optionDefinitions
  }
])

const SLACK_COOKIE: string = process.env.SLACK_COOKIE!
const SLACK_XOXC_TOKEN: string = process.env.SLACK_XOXC_TOKEN!

async function slackRequest(path: string, method = "POST", formData: any = null) {
  const form = new FormData()
  form.append("token", SLACK_XOXC_TOKEN)
  if (formData) {
    for (const item of formData) form.append(item.key, item.value)
  }

  const response = await fetch(`https://vendrco.slack.com${path}`, {
    method: method,
    headers: { Cookie: SLACK_COOKIE },
    body: method === "GET" ? null : form,
  })

  const r: any = await response.json()
  if (r.error) throw Error(`Slack API request failed with error: ${r.error}`)
  return r
}

async function getUserGroups() {
  return slackRequest("/api/usergroups.list")
}

async function getUserProfile(userId: string) {
  return slackRequest('/api/users.profile.get', "POST", [
    { key: "user", value: userId }
  ])
}

async function getMySections() {
  const sections: any = await slackRequest("/api/users.channelSections.list")
  return sections.channel_sections
}

async function createSection(section: any) {
  return slackRequest("/api/users.channelSections.create", "POST", [
    { key: "name", value: section.name },
    { key: "emoji", value: "" },
  ])
}

async function deleteSection(section: any) {
  return slackRequest("/api/users.channelSections.delete", "POST", [
    { key: "channel_section_id", value: section.channel_section_id },
  ])
}

async function getMyChannels() {
  const channels: any = await slackRequest("/api/client.counts", "POST", [{ key: "channel", value: "" }])
  return channels ? channels.channels : null
}

async function getChannel(channelId: string) {
  try {
    const channel: any = await slackRequest(`/api/conversations.info?channel=${channelId}`)
    return channel?.channel ? channel.channel : null
  } catch (e) {
    return null;
  }
}

export function findExistingSection(sections: any, userGroup: any) {
  return sections.find((section: any) => section.name.toLowerCase() === userGroup.name.toLowerCase() || section.name.toLowerCase() === userGroup.handle.toLowerCase())
}

export function findSectionContainingChannel(sections: any, channelId: string) {
  return sections.find((section: any) => {
    return section.channel_ids_page?.channel_ids?.find((id: string) => id === channelId)
  })
}

export function addToMap(map: any, parent: any, parentKey: string, child: any) {
  if (!map[parentKey]) {
    map[parentKey] = { parent: parent, children: [] }
  }
  if (!map[parentKey].children.find((c: any) => c.id && c.id === child.id)) map[parentKey].children.push(child)
}

async function joinChannel(channel: any) {
  return slackRequest("/api/conversations.join", "POST", [{ key: "channel", value: channel.id }])
}

export function mapSectionChannelUpdates(updates: any) {
  return Object.keys(updates).reduce((map: any, key: string) => {
    const update = updates[key]
    if (update.children.length > 0)
      map.push({
        channel_section_id: update.parent.channel_section_id,
        channel_ids: update.children.map((channel: any) => channel.id),
      })
    return map
  }, [])
}

async function updateSectionChannels(inserts: any, removals: any) {
  return slackRequest("/api/users.channelSections.channels.bulkUpdate", "POST", [
    { key: "remove", value: JSON.stringify(mapSectionChannelUpdates(removals)) },
    { key: "insert", value: JSON.stringify(mapSectionChannelUpdates(inserts)) },
  ])
}

export function filterUserGroups(userGroups: any, handles: string[] = [], tags: string[] = []) {
  return handles.length == 0 && tags.length == 0 ? userGroups : userGroups.filter((userGroup: any) => {
    if (handles.includes(userGroup.handle)) return true
    if (tags.find((tag: string) => userGroup.description.toLowerCase().indexOf(tag) >= 0)) return true
    return false
  })
}

async function analyzeUserGroups(
  userGroups: any[],
  getMyChannels: () => Promise<any>,
  addChannelInsert: (section: any, channel: any) => void,
  addChannelRemoval: (section: any, channel: any) => void,
  addSectionToCreate: (section: any) => void,
  addChannelToJoin: (channel: any) => void,
  addToChannelSectionMap: (channel: any, section: any) => void
) {
  const myChannels = await getMyChannels()
  const mySections = await getMySections()

  for (const userGroup of userGroups) {
    await processUserGroup(
      userGroup,
      myChannels,
      mySections,
      addChannelInsert,
      addChannelRemoval,
      addSectionToCreate,
      addChannelToJoin,
      addToChannelSectionMap
    )
  }
}

export async function processUserGroup(
  userGroup: any,
  myChannels: any[],
  mySections: any[],
  addChannelInsert: (section: any, channel: any) => void,
  addChannelRemoval: (section: any, channel: any) => void,
  addSectionToCreate: (section: any) => void,
  addChannelToJoin: (channel: any) => void,
  addToChannelSectionMap: (channel: any, section: any) => void
) {
  let sectionForUserGroup = findExistingSection(mySections, userGroup)
  if (!sectionForUserGroup) {
    sectionForUserGroup = { name: userGroup.name, channel_section_id: null }
    addSectionToCreate(sectionForUserGroup)
  }

  process.stdout.write(`\nRetrieving channels for user group: ${userGroup.name}... `)
  const channels = await getChannelsForUserGroup(userGroup)
  process.stdout.write(`\n`)

  channels.forEach((channel: any) => {
    processChannel(
      channel,
      myChannels,
      mySections,
      sectionForUserGroup,
      () => { return options['join-channels']},
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap)
  })
}

async function getChannelsForUserGroup(userGroup: any) {
  const channels: any = []
  for (const channelId of userGroup.prefs.channels) {
    const channel = await getChannel(channelId)
    if (channel) {
      channels.push(channel)
      process.stdout.write(`${channel.name} `)
    }
  }
  return channels
}

export function processChannel(
  channel: any,
  myChannels: any[],
  mySections: any[],
  sectionForUserGroup: any,
  isJoiningChannels: () => boolean,
  addChannelInsert: (section: any, channel: any) => void,
  addChannelRemoval: (section: any, channel: any) => void,
  addChannelToJoin: (channel: any) => void,
  addToChannelSectionMap: (channel: any, section: any) => void
) {
  const joinedChannel = myChannels.find((c: any) => c.id === channel.id)
  if (!joinedChannel) {
    addChannelToJoin(channel)
    if (!isJoiningChannels()) return
  }

  const currentSection = findSectionContainingChannel(mySections, channel.id)

  if (currentSection && currentSection.channel_section_id !== sectionForUserGroup.channel_section_id) {
    addChannelRemoval(currentSection, channel)
    addChannelInsert(sectionForUserGroup, channel)
  } else if (!currentSection){
    addChannelInsert(sectionForUserGroup, channel)
  }

  addToChannelSectionMap(channel, sectionForUserGroup)
}

export function getMapObjectsWithMultipleChildren(map: any) {
  return map ? Object.keys(map).reduce((newMap: any, key: string) => {
    if (map[key]?.children?.length > 1) newMap.push(map[key])
    return newMap
  }, []) : []
}

export async function handleChannelsWithMultiSections(
  channelSectionMap: any,
  inserts: any,
  removals: any,
  removeChannelInsert: (inserts: any, section: any, channel: any) => void,
  removeChannelRemoval: (removals: any, section: any, channel: any) => void,
) {
  const channelsWithMultiSections = getMapObjectsWithMultipleChildren(channelSectionMap)
  for (const channel of channelsWithMultiSections) {
    const userProfile = await getUserProfile(channel.parent.creator)
    const userDisplay = userProfile?.profile ? `${userProfile.profile.real_name}, ${userProfile.profile.title}` : 'unknown'
    console.log(`\n${channel.parent.name} (created by: ${userDisplay}) is in multiple user groups:`)
    for (let i = 0; i < channel.children.length; i++) {
      const section = channel.children[i]
      console.log(`${i}: ${section.name}`)
    }
    let sectionOption = -1
    do {
      sectionOption = parseInt(readlineSync.question(`\Please select which section to add this channel to: `))
    } while (isNaN(sectionOption) || sectionOption < 0 || sectionOption >= channel.children.length)
    const selectedSection = channel.children[sectionOption]

    removeChannelInsert(inserts, selectedSection, channel)
    removeChannelRemoval(removals, selectedSection, channel)
  }
}

export function removeChannelInsert(inserts: any, section: any, channel: any) {
  for (const key of Object.keys(inserts)) {
    const insert = inserts[key]
    if (section.name !== insert.parent.name) {
      insert.children = insert.children.filter((c: any) => c.id !== channel.parent.id)
    }
  }
}

export function removeChannelRemoval(removals: any, section: any, channel: any) {
  const removal = removals[section.channel_section_id]
  if (removal) {
    removal.children = removal.children.filter((c: any) => c.id !== channel.parent.id)
  }
}

export function setChannelSectionId(map: any, section: any, newSection: any) {
  const key: any = Object.keys(map).find(
    (key: string) => {
      return (section.channel_section_id && key === section.channel_section_id) || key === section.name
    }
  )
  if (key) map[key].parent.channel_section_id = newSection.channel_section_id
}

async function run() {
  if (options.help) {
    console.log(usage)
    process.exit(0)
  }

  const allUserGroups: any = await getUserGroups()
  const handles = options['group-handle']
  const tags = options['group-desc-tag']
  if (!handles && !tags) {
    const proceed = readlineSync.question(`\Are you sure you wish to organize sections for all user groups (hint: re-run with -h for options)? (y/N) `)
    if (proceed.toLowerCase() !== "y") {
      console.log(usage)
      process.exit(0)
    }
  }
  const userGroups = filterUserGroups(allUserGroups.usergroups, handles, tags)

  console.log("\nOrganizing Slack sections for the following user groups:")
  for (const group of userGroups) {
    console.log(`${group.name} (@${group.handle})`)
  }

  const inserts: any = []
  const addChannelInsert = (section: any, channel: any) => {
    addToMap(inserts, section, section.channel_section_id || section.name, channel)
  }

  const removals: any = []
  const addChannelRemoval = (section: any, channel: any) => {
    addToMap(removals, section, section.channel_section_id || section.name, channel)
  }

  const sectionsToCreate: any = []
  const addSectionToCreate = (section: any) => {
    sectionsToCreate.push(section)
  }

  const channelsToJoin: any = []
  const addChannelToJoin = (channel: any) => {
    if (!channelsToJoin.find((c: any) => c.id === channel.id)) channelsToJoin.push(channel)
  }

  const channelSectionMap: any = []
  const addToChannelSectionMap = (channel: any, section: any) => {
    addToMap(channelSectionMap, channel, channel.name, section)
  }

  await analyzeUserGroups(
    userGroups,
    getMyChannels,
    addChannelInsert,
    addChannelRemoval,
    addSectionToCreate,
    addChannelToJoin,
    addToChannelSectionMap
  )

  await handleChannelsWithMultiSections(channelSectionMap, inserts, removals, removeChannelInsert, removeChannelRemoval)

  console.log(`\n\n------- STAGED UPDATES -------`)

  console.log(`\nSections to create:`)
  for (const section of sectionsToCreate) {
    console.log(`    ${section.name}`)
  }

  if (channelsToJoin.length > 0) {
    if (options['join-channels']) console.log(`\nChannels to join:`)
    else console.log(`\nChannels not joining (re-run with -j to auto join these channels):`)
    for (const channel of channelsToJoin) {
      console.log(`    ${channel.name}`)
    }
  }

  console.log(`\nChannels to move:`)
  for (const key of Object.keys(removals)) {
    const removal = removals[key]
    for (const channel of removal.children) {
      console.log(`    Removing ${channel.name} from ${removal.parent.name}`)
    }
  }

  for (const key of Object.keys(inserts)) {
    const insert = inserts[key]
    for (const channel of insert.children) {
      console.log(`    Adding ${channel.name} to ${insert.parent.name}`)
    }
  }

  const proceedOption = readlineSync.question(`\nWould you like to proceed with the updates above? (Y/n) `)
  if (proceedOption.toLowerCase() === "y" || proceedOption === "") {
    for (const section of sectionsToCreate) {
      console.log(`Creating section: ${section.name}...`)
      const newSection = await createSection(section)
      setChannelSectionId(inserts, section, newSection)
      setChannelSectionId(removals, section, newSection)
    }

    if (options['join-channels']) {
      for (const channel of channelsToJoin) {
        console.log(`Joining channel: ${channel.name}...`)
        await joinChannel(channel)
      }
    }

    if (Object.keys(inserts).length > 0 || Object.keys(removals).length > 0) {
      console.log("Moving channels...")
      const response = await updateSectionChannels(inserts, removals)
    }
  }

  const updatedSections = await getMySections()
  const emptySections = updatedSections.filter(
    (section: any) => section.type === "standard" && section.channel_ids_page?.channel_ids?.length == 0,
  )

  if (options['delete-empty-sections'] && emptySections.length > 0) {
    console.log("\nEmpty sections:")
    for (const section of emptySections) {
      console.log(`    ${section.name}`)
    }

    const deleteOption = readlineSync.question(`\nWould you like to delete the empty sections above? (Y/n) `)

    if (deleteOption === "" || deleteOption.toLowerCase() === "y") {
      for (const section of emptySections) {
        await deleteSection(section)
      }
    }
  }

  console.log("Done!")
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.stack)
      process.exit(1)
    })
}