import { describe, it, expect } from 'vitest';
import {
  buildTree,
  flattenTree,
  Role,
  TreeNode,
} from '@/components/admin/role-list';

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    const result = buildTree([]);
    expect(result).toEqual([]);
  });

  it('creates root nodes for roles without parents', () => {
    const roles: Role[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: 'Basic user',
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 10,
      },
      {
        id: '2',
        name: 'ROLE_SUPPORT',
        description: 'Support role',
        parentId: null,
        parentName: null,
        isSystem: false,
        userCount: 5,
      },
    ];

    const result = buildTree(roles);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('ROLE_USER');
    expect(result[0].depth).toBe(0);
    expect(result[0].children).toEqual([]);
    expect(result[1].name).toBe('ROLE_SUPPORT');
    expect(result[1].depth).toBe(0);
  });

  it('builds parent-child relationships correctly', () => {
    const roles: Role[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 100,
      },
      {
        id: '2',
        name: 'ROLE_MODERATOR',
        description: null,
        parentId: '1',
        parentName: 'ROLE_USER',
        isSystem: true,
        userCount: 10,
      },
      {
        id: '3',
        name: 'ROLE_ADMIN',
        description: null,
        parentId: '2',
        parentName: 'ROLE_MODERATOR',
        isSystem: true,
        userCount: 2,
      },
    ];

    const result = buildTree(roles);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ROLE_USER');
    expect(result[0].depth).toBe(0);
    expect(result[0].children).toHaveLength(1);

    const moderator = result[0].children[0];
    expect(moderator.name).toBe('ROLE_MODERATOR');
    expect(moderator.depth).toBe(1);
    expect(moderator.children).toHaveLength(1);

    const admin = moderator.children[0];
    expect(admin.name).toBe('ROLE_ADMIN');
    expect(admin.depth).toBe(2);
    expect(admin.children).toEqual([]);
  });

  it('handles multiple roots with children', () => {
    const roles: Role[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 50,
      },
      {
        id: '2',
        name: 'ROLE_MODERATOR',
        description: null,
        parentId: '1',
        parentName: 'ROLE_USER',
        isSystem: true,
        userCount: 5,
      },
      {
        id: '3',
        name: 'ROLE_SUPPORT',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: false,
        userCount: 10,
      },
      {
        id: '4',
        name: 'ROLE_SUPPORT_LEAD',
        description: null,
        parentId: '3',
        parentName: 'ROLE_SUPPORT',
        isSystem: false,
        userCount: 2,
      },
    ];

    const result = buildTree(roles);

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('ROLE_USER');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].name).toBe('ROLE_MODERATOR');

    expect(result[1].name).toBe('ROLE_SUPPORT');
    expect(result[1].children).toHaveLength(1);
    expect(result[1].children[0].name).toBe('ROLE_SUPPORT_LEAD');
  });

  it('handles orphan roles with missing parent as roots', () => {
    const roles: Role[] = [
      {
        id: '1',
        name: 'ROLE_ORPHAN',
        description: null,
        parentId: 'non-existent-id',
        parentName: 'MISSING',
        isSystem: false,
        userCount: 1,
      },
    ];

    const result = buildTree(roles);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ROLE_ORPHAN');
    expect(result[0].depth).toBe(0);
  });
});

describe('flattenTree', () => {
  it('returns empty array for empty input', () => {
    const result = flattenTree([]);
    expect(result).toEqual([]);
  });

  it('flattens single node', () => {
    const nodes: TreeNode[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 10,
        children: [],
        depth: 0,
      },
    ];

    const result = flattenTree(nodes);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('ROLE_USER');
  });

  it('flattens tree in depth-first order', () => {
    const nodes: TreeNode[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 100,
        depth: 0,
        children: [
          {
            id: '2',
            name: 'ROLE_MODERATOR',
            description: null,
            parentId: '1',
            parentName: 'ROLE_USER',
            isSystem: true,
            userCount: 10,
            depth: 1,
            children: [
              {
                id: '3',
                name: 'ROLE_ADMIN',
                description: null,
                parentId: '2',
                parentName: 'ROLE_MODERATOR',
                isSystem: true,
                userCount: 2,
                depth: 2,
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const result = flattenTree(nodes);

    expect(result).toHaveLength(3);
    expect(result.map((n) => n.name)).toEqual([
      'ROLE_USER',
      'ROLE_MODERATOR',
      'ROLE_ADMIN',
    ]);
    expect(result.map((n) => n.depth)).toEqual([0, 1, 2]);
  });

  it('flattens multiple roots in order', () => {
    const nodes: TreeNode[] = [
      {
        id: '1',
        name: 'ROLE_A',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: false,
        userCount: 5,
        depth: 0,
        children: [
          {
            id: '2',
            name: 'ROLE_A_CHILD',
            description: null,
            parentId: '1',
            parentName: 'ROLE_A',
            isSystem: false,
            userCount: 2,
            depth: 1,
            children: [],
          },
        ],
      },
      {
        id: '3',
        name: 'ROLE_B',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: false,
        userCount: 3,
        depth: 0,
        children: [],
      },
    ];

    const result = flattenTree(nodes);

    expect(result).toHaveLength(3);
    expect(result.map((n) => n.name)).toEqual([
      'ROLE_A',
      'ROLE_A_CHILD',
      'ROLE_B',
    ]);
  });

  it('preserves all node properties', () => {
    const nodes: TreeNode[] = [
      {
        id: 'test-id',
        name: 'ROLE_TEST',
        description: 'Test description',
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 42,
        depth: 0,
        children: [],
      },
    ];

    const result = flattenTree(nodes);

    expect(result[0]).toEqual({
      id: 'test-id',
      name: 'ROLE_TEST',
      description: 'Test description',
      parentId: null,
      parentName: null,
      isSystem: true,
      userCount: 42,
      depth: 0,
      children: [],
    });
  });
});

describe('buildTree + flattenTree integration', () => {
  it('round-trips correctly for hierarchy', () => {
    const roles: Role[] = [
      {
        id: '1',
        name: 'ROLE_USER',
        description: null,
        parentId: null,
        parentName: null,
        isSystem: true,
        userCount: 100,
      },
      {
        id: '2',
        name: 'ROLE_MODERATOR',
        description: null,
        parentId: '1',
        parentName: 'ROLE_USER',
        isSystem: true,
        userCount: 10,
      },
      {
        id: '3',
        name: 'ROLE_ADMIN',
        description: null,
        parentId: '2',
        parentName: 'ROLE_MODERATOR',
        isSystem: true,
        userCount: 2,
      },
    ];

    const tree = buildTree(roles);
    const flattened = flattenTree(tree);

    expect(flattened).toHaveLength(3);
    expect(flattened.map((n) => ({ name: n.name, depth: n.depth }))).toEqual([
      { name: 'ROLE_USER', depth: 0 },
      { name: 'ROLE_MODERATOR', depth: 1 },
      { name: 'ROLE_ADMIN', depth: 2 },
    ]);
  });
});
