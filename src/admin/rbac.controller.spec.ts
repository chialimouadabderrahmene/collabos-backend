import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RbacController } from './rbac.controller';
import { RbacService } from './services/rbac.service';

describe('RbacController', () => {
  let rbacService: {
    listPermissions: ReturnType<typeof vi.fn>;
    listRoles: ReturnType<typeof vi.fn>;
    createRole: ReturnType<typeof vi.fn>;
    setRolePermissions: ReturnType<typeof vi.fn>;
  };
  let controller: RbacController;

  beforeEach(() => {
    rbacService = {
      listPermissions: vi.fn().mockResolvedValue([]),
      listRoles: vi.fn().mockResolvedValue([]),
      createRole: vi.fn(),
      setRolePermissions: vi.fn(),
    };
    controller = new RbacController(rbacService as unknown as RbacService);
  });

  it('delegates listPermissions to the service', async () => {
    await controller.listPermissions();
    expect(rbacService.listPermissions).toHaveBeenCalled();
  });

  it('delegates listRoles to the service', async () => {
    await controller.listRoles();
    expect(rbacService.listRoles).toHaveBeenCalled();
  });

  it('delegates createRole to the service', async () => {
    await controller.createRole({ name: 'BRAND_MODERATOR' });
    expect(rbacService.createRole).toHaveBeenCalledWith({
      name: 'BRAND_MODERATOR',
    });
  });

  it('delegates setRolePermissions to the service', async () => {
    await controller.setRolePermissions('role-1', {
      permissions: ['users:manage'],
    });
    expect(rbacService.setRolePermissions).toHaveBeenCalledWith('role-1', {
      permissions: ['users:manage'],
    });
  });
});
