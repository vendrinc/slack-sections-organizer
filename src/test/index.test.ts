import {
  findExistingSection,
  findSectionContainingChannel,
  addToMap,
  mapSectionChannelUpdates,
  filterUserGroups,
  processUserGroup,
  processChannel,
  removeChannelInsert,
  removeChannelRemoval,
  getMapObjectsWithMultipleChildren,
  handleChannelsWithMultiSections,
  setChannelSectionId } from '../index';

const readlineSync = require("readline-sync")

jest.mock('readline-sync', () => ({
  question: jest.fn(),
}));

describe('findExistingSection', () => {
    it('should find a section by matching name', () => {
      const sections = [
        { name: 'Section 1', otherProperty: 'value' },
        { name: 'Section 2', otherProperty: 'another value' },
      ];
  
      const userGroup = {
        name: 'Section 1',
        handle: 'group-handle',
      };
  
      const result = findExistingSection(sections, userGroup);
      expect(result).toEqual(sections[0]);
    });
  
    it('should find a section by matching handle', () => {
      const sections = [
        { name: 'Section 1', otherProperty: 'value' },
        { name: 'Section 2', otherProperty: 'another value' },
      ];
  
      const userGroup = {
        name: 'Different Name',
        handle: 'section 2',
      };
  
      const result = findExistingSection(sections, userGroup);
      expect(result).toEqual(sections[1]);
    });
  
    it('should return undefined if no matching section is found', () => {
      const sections = [
        { name: 'Section 1', otherProperty: 'value' },
        { name: 'Section 2', otherProperty: 'another value' },
      ];
  
      const userGroup = {
        name: 'Non-existing Name',
        handle: 'non-existing-handle',
      };
  
      const result = findExistingSection(sections, userGroup);
      expect(result).toBeUndefined();
    });
  
    it('should be case-insensitive when matching names and handles', () => {
      const sections = [
        { name: 'SECTION 1', otherProperty: 'value' },
        { name: 'section 2', otherProperty: 'another value' },
      ];
  
      const userGroup = {
        name: 'section 1',
        handle: 'SECTION 2',
      };
  
      const resultByName = findExistingSection(sections, { name: userGroup.name, handle: '' });
      const resultByHandle = findExistingSection(sections, { name: '', handle: userGroup.handle });
  
      expect(resultByName).toEqual(sections[0]);
      expect(resultByHandle).toEqual(sections[1]);
    });
});

describe('findSectionContainingChannel', () => {
    it('should find a section containing the specified channel ID', () => {
      const sections = [
        {
          name: 'Section 1',
          channel_ids_page: {
            channel_ids: ['C123', 'C456'],
          },
        },
        {
          name: 'Section 2',
          channel_ids_page: {
            channel_ids: ['C789', 'C1011'],
          },
        },
      ];
  
      const channelId = 'C789';
      const result = findSectionContainingChannel(sections, channelId);
      expect(result).toEqual(sections[1]);
    });
  
    it('should return undefined if no section contains the specified channel ID', () => {
      const sections = [
        {
          name: 'Section 1',
          channel_ids_page: {
            channel_ids: ['C123', 'C456'],
          },
        },
        {
          name: 'Section 2',
          channel_ids_page: {
            channelids: ['C789', 'C1011'],
        },
      },
    ];

    const channelId = 'C999';
    const result = findSectionContainingChannel(sections, channelId);
    expect(result).toBeUndefined();
  });

  it('should handle sections with missing channel_ids_page or channel_ids properties', () => {
    const sections = [
      {
        name: 'Section 1',
        channel_ids_page: {
          channel_ids: ['C123', 'C456'],
        },
      },
      {
        name: 'Section 2',
        channel_ids_page: null,
      },
      {
        name: 'Section 3',
        channel_ids_page: {
          channel_ids: null,
        },
      },
    ];

    const channelId = 'C123';
    const result = findSectionContainingChannel(sections, channelId);
    expect(result).toEqual(sections[0]);
  });
});

describe('addToMap', () => {
  it('should add a new key to the map with the parent and child', () => {
    const map: any = {};
    const parent = { name: 'parent' };
    const parentKey = 'parentKey';
    const child = { name: 'child' };

    addToMap(map, parent, parentKey, child);

    expect(map).toEqual({
      parentKey: {
        parent: { name: 'parent' },
        children: [{ name: 'child' }],
      },
    });
  });

  it('should add multiple children to the same parent key', () => {
    const map: any = {};
    const parent = { name: 'parent' };
    const parentKey = 'parentKey';
    const child1 = { name: 'child1' };
    const child2 = { name: 'child2' };

    addToMap(map, parent, parentKey, child1);
    addToMap(map, parent, parentKey, child2);

    expect(map).toEqual({
      parentKey: {
        parent: { name: 'parent' },
        children: [
          { name: 'child1' },
          { name: 'child2' },
        ],
      },
    });
  });

  it('should add children to different parent keys', () => {
    const map: any = {};
    const parent1 = { name: 'parent1' };
    const parentKey1 = 'parentKey1';
    const child1 = { name: 'child1' };
    const parent2 = { name: 'parent2' };
    const parentKey2 = 'parentKey2';
    const child2 = { name: 'child2' };

    addToMap(map, parent1, parentKey1, child1);
    addToMap(map, parent2, parentKey2, child2);

    expect(map).toEqual({
      parentKey1: {
        parent: { name: 'parent1' },
        children:[
          { name: 'child1' },
        ],
      },
      parentKey2: {
        parent: { name: 'parent2' },
        children: [
          { name: 'child2' },
        ],
      },
    });
  });
});

describe('mapSectionChannelUpdates', () => {
  it('should return an empty array when the input is an empty object', () => {
    const updates = {};
    const result = mapSectionChannelUpdates(updates);
    expect(result).toEqual([]);
  });
  
  it('should return an array of objects with channel_section_id and channel_ids', () => {
    const updates = {
      section1: {
        parent: { channel_section_id: "1" },
        children: [{ id: 101 }, { id: 102 }],
      },
      section2: {
        parent: { channel_section_id: "2" },
        children: [{ id: 201 }, { id: 202 }],
      },
    };
    const result = mapSectionChannelUpdates(updates);
    expect(result).toEqual([
      { channel_section_id: "1", channel_ids: [101, 102] },
      { channel_section_id: "2", channel_ids: [201, 202] },
    ]);
  });
  
  it('should not include sections with an empty channels array', () => {
    const updates = {
      section1: {
        parent: { channel_section_id: "1" },
        children: [{ id: 101 }, { id: 102 }],
      },
      section2: {
        parent: { channel_section_id: "2" },
        children: [],
      },
    };
    const result = mapSectionChannelUpdates(updates);
    expect(result).toEqual([
      { channel_section_id: "1", channel_ids: [101, 102] },
    ]);
  });

  it('should return an empty array when all sections have empty channels arrays', () => {
    const updates = {
      section1: {
        parent: { channel_section_id: "1" },
        children: [],
      },
      section2: {
        parent: { channel_section_id: "2" },
        children: [],
      },
    };
    const result = mapSectionChannelUpdates(updates);
    expect(result).toEqual([]);
  });
});

describe('filterUserGroups', () => {
    const userGroups = [
      { handle: 'group1', description: 'This is group 1' },
      { handle: 'group2', description: 'This is group 2' },
      { handle: 'group3', description: 'This is group 3' },
    ];
  
    it('should return the same array when handles and tags are not provided', () => {
      const result = filterUserGroups(userGroups);
      expect(result).toEqual(userGroups);
    });
  
    it('should filter by handle when handles are provided', () => {
      const handles = ['group1', 'group3'];
      const result = filterUserGroups(userGroups, handles);
      expect(result).toEqual([
        { handle: 'group1', description: 'This is group 1' },
        { handle: 'group3', description: 'This is group 3' },
      ]);
    });
  
    it('should filter by tag when tags are provided', () => {
      const tags = ['#group1', '#group2', '#group3'];
      const userGroupsWithTags = [
        { handle: 'group1', description: 'This is #group1' },
        { handle: 'group2', description: 'This is #group2' },
        { handle: 'group3', description: 'This is group 3' },
      ];
      const result = filterUserGroups(userGroupsWithTags, undefined, tags);
      expect(result).toEqual([
        { handle: 'group1', description: 'This is #group1' },
        { handle: 'group2', description: 'This is #group2' },
      ]);
    });
  
    it('should filter by both handle and tag when both are provided', () => {
      const handles = ['group1'];
      const tags = ['#group2'];
      const userGroupsWithTags = [
        { handle: 'group1', description: 'This is #group1' },
        { handle: 'group2', description: 'This is #group2' },
        { handle: 'group3', description: 'This is group 3' },
      ];
      const result = filterUserGroups(userGroupsWithTags, handles, tags);
      expect(result).toEqual([
        { handle: 'group1', description: 'This is #group1' },
        { handle: 'group2', description: 'This is #group2' },
      ]);
    });
  
    it('should return an empty array when no user groups match the provided handles and tags', () => {
      const handles = ['group4'];
      const tags = ['#group4'];
      const result = filterUserGroups(userGroups, handles, tags);
      expect(result).toEqual([]);
    });
});

describe('processChannel', () => {
  const testChannel = { id: 'C12345', name: 'test-channel' };

  const isJoiningChannels = () => { return true };
  const isNotJoiningChannels = () => { return false };

  const addChannelInsert = jest.fn();
  const addChannelRemoval = jest.fn();
  const addChannelToJoin = jest.fn();
  const addToChannelSectionMap = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add a channel to join list if not in myChannels', () => {
    const myChannels: any[] = [];
    const mySections: any[] = [];
    const sectionForUserGroup = { name: 'Test Section', channel_section_id: 'S12345' };
  
    processChannel(
      testChannel,
      myChannels,
      mySections,
      sectionForUserGroup,
      isJoiningChannels,
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addChannelToJoin).toHaveBeenCalledWith(testChannel);
  });

  it('should add a channel to join list but not channelSectionMap if not in myChannels and not joining channels', () => {
    const myChannels: any[] = [];
    const mySections: any[] = [];
    const sectionForUserGroup = { name: 'Test Section', channel_section_id: 'S12345' };
  
    processChannel(
      testChannel,
      myChannels,
      mySections,
      sectionForUserGroup,
      isNotJoiningChannels,
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addChannelToJoin).toHaveBeenCalledWith(testChannel);
    expect(addToChannelSectionMap).not.toHaveBeenCalled();
  });

  it('should not add a channel to join list if already in myChannels', () => {
    const myChannels = [testChannel];
    const mySections: any[] = [];
    const sectionForUserGroup = { name: 'Test Section', channel_section_id: 'S12345' };
  
    processChannel(
      testChannel,
      myChannels,
      mySections,
      sectionForUserGroup,
      isJoiningChannels,
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addChannelToJoin).not.toHaveBeenCalled();
  });

  it('should add a channel to the correct section', () => {
    const myChannels = [testChannel];
    const mySections = [{ name: 'Test Section', channels: [], channel_section_id: 'S12345' }];
    const sectionForUserGroup = { name: 'Test Section', channel_section_id: 'S12345' };
  
    processChannel(
      testChannel,
      myChannels,
      mySections,
      sectionForUserGroup,
      isJoiningChannels,
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addChannelInsert).toHaveBeenCalledWith(sectionForUserGroup, testChannel);
    expect(addToChannelSectionMap).toHaveBeenCalledWith(testChannel, sectionForUserGroup);
  });

  it('should move a channel from one section to another', () => {
    const myChannels = [{ id: 'C12345', name: 'test-channel' }];
    const sectionForUserGroup = { name: 'Test Section', channel_section_id: 'S12345' };
    const mySections = [
      { name: 'Old Section', channel_ids_page: { channel_ids: [testChannel.id] }, channel_section_id: 'S11111' },
      sectionForUserGroup
    ];

    processChannel(
      testChannel,
      myChannels,
      mySections,
      sectionForUserGroup,
      isJoiningChannels,
      addChannelInsert,
      addChannelRemoval,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addChannelRemoval).toHaveBeenCalledWith(mySections[0], testChannel);
    expect(addChannelInsert).toHaveBeenCalledWith(sectionForUserGroup, testChannel);
    expect(addToChannelSectionMap).toHaveBeenCalledWith(testChannel, sectionForUserGroup);
  });
});

describe('processUserGroup', () => {
  const mockGetChannelsForUserGroup = jest.fn();

  const addChannelInsert = jest.fn();
  const addChannelRemoval = jest.fn();
  const addSectionToCreate = jest.fn();
  const addChannelToJoin = jest.fn();
  const addToChannelSectionMap = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should add a new section to create if not in mySections', async () => {
    const userGroup = { name: 'Test Group', prefs: { channels: ['C12345'] } };
    const myChannels: any[] = [];
    const mySections: any[] = [];

    mockGetChannelsForUserGroup.mockResolvedValue([{ id: 'C12345', name: 'test-channel' }]);

    await processUserGroup(
      userGroup,
      myChannels,
      mySections,
      addChannelInsert,
      addChannelRemoval,
      addSectionToCreate,
      addChannelToJoin,
      addToChannelSectionMap
    );

    expect(addSectionToCreate).toHaveBeenCalledWith({ name: 'Test Group', channel_section_id: null });
  });
});

describe('getMapObjectsWithMultipleChildren', () => {
  it('should return an array of map objects with multiple children', () => {
    const input = {
      a: { children: [{ id: 1 }, { id: 2 }] },
      b: { children: [{ id: 3 }] },
      c: { children: [{ id: 4 }, { id: 5 }, { id: 6 }] },
    };

    const expectedOutput = [
      { children: [{ id: 1 }, { id: 2 }] },
      { children: [{ id: 4 }, { id: 5 }, { id: 6 }] },
    ];

    expect(getMapObjectsWithMultipleChildren(input)).toEqual(expectedOutput);
  });

  it('should return an empty array if no map objects have multiple children', () => {
    const input = {
      a: { children: [{ id: 1 }] },
      b: { children: [{ id: 3 }] },
      c: { children: [{ id: 4 }] },
    };

    const expectedOutput: any[] = [];

    expect(getMapObjectsWithMultipleChildren(input)).toEqual(expectedOutput);
  });

  it('should return an empty array if the input object is empty', () => {
    const input = {};

    const expectedOutput: any[] = [];

    expect(getMapObjectsWithMultipleChildren(input)).toEqual(expectedOutput);
  });

  it('should return an empty array if the input object is null or undefined', () => {
    const input1 = null;
    const input2 = undefined;

    const expectedOutput: any[] = [];

    expect(getMapObjectsWithMultipleChildren(input1)).toEqual(expectedOutput);
    expect(getMapObjectsWithMultipleChildren(input2)).toEqual(expectedOutput);
  });
});

describe('removeChannelInsert', () => {
  it('should remove the channel from inserts of sections not matching the selected section', () => {
    const inserts = {
      insert1: {
        parent: { name: 'Section 1' },
        children: [
          { id: 1 },
          { id: 2 },
        ],
      },
      insert2: {
        parent: { name: 'Section 2' },
        children: [
          { id: 1 },
          { id: 3 },
        ],
      },
    };

    const section = { name: 'Section 1' };
    const channel = { parent: { id: 1 } };

    const expectedInserts = {
      insert1: {
        parent: { name: 'Section 1' },
        children: [
          { id: 1 },
          { id: 2 },
        ],
      },
      insert2: {
        parent: { name: 'Section 2' },
        children: [
          { id: 3 },
        ],
      },
    };

    removeChannelInsert(inserts, section, channel);

    expect(inserts).toEqual(expectedInserts);
  });
});

describe('removeChannelRemoval', () => {
  it('should remove the channel from removals of the selected section', () => {
    const removals = {
      1: {
        children: [
          { id: 1 },
          { id: 2 },
        ],
      },
      2: {
        children: [
          { id: 1 },
          { id: 3 },
        ],
      },
    };

    const section = { channel_section_id: "1" };
    const channel = { parent: { id: 1 } };

    const expectedRemovals = {
      1: {
        children: [
          { id: 2 },
        ],
      },
      2: {
        children: [
          { id: 1 },
          { id: 3 },
        ],
      },
    };

    removeChannelRemoval(removals, section, channel);

    expect(removals).toEqual(expectedRemovals);
  });

  it('should not throw an error if the selected section has no removals', () => {
    const removals = {
      1: {
        children: [
          { id: 1 },
          { id: 2 },
        ],
      },
    };

    const section = { channel_section_id: "2" };
    const channel = { parent: { id: 1 } };

    const expectedRemovals = {
      1: {
        children: [
          { id: 1 },
          { id: 2 },
        ],
      },
    };

    expect(() => removeChannelRemoval(removals, section, channel)).not.toThrow();
    expect(removals).toEqual(expectedRemovals);
  });
});

describe('setChannelSectionId', () => {
  it('should update the channel_section_id of the section in the map based on the section name', () => {
    const map = {
      'Section 1': {
        parent: { name: 'Section 1', channel_section_id: "1" },
      },
      'Section 2': {
        parent: { name: 'Section 2', channel_section_id: "2" },
      },
    };

    const section = { name: 'Section 1' };
    const newSection = { channel_section_id: "3" };

    setChannelSectionId(map, section, newSection);

    expect(map['Section 1'].parent.channel_section_id).toBe("3");
    expect(map['Section 2'].parent.channel_section_id).toBe("2");
  });

  it('should update the channel_section_id of the section in the map based on the section channel_section_id', () => {
    const map = {
      "1": {
        parent: { name: 'Section 1', channel_section_id: "1" },
      },
      "2": {
        parent: { name: 'Section 2', channel_section_id: "2" },
      },
    };

    const section = { channel_section_id: "1" };
    const newSection = { channel_section_id: "3" };

    setChannelSectionId(map, section, newSection);

    expect(map[1].parent.channel_section_id).toBe("3");
    expect(map[2].parent.channel_section_id).toBe("2");
  });

  it('should not modify the map if no matching section is found', () => {
    const map = {
      'Section 1': {
        parent: { name: 'Section 1', channel_section_id: "1" },
      },
      'Section 2': {
        parent: { name: 'Section 2', channel_section_id: "2" },
      },
    };

    const section = { name: 'Section 3' };
    const newSection = { channel_section_id: "3" };

    setChannelSectionId(map, section, newSection);

    expect(map['Section 1'].parent.channel_section_id).toBe("1");
    expect(map['Section 2'].parent.channel_section_id).toBe("2");
  });
});