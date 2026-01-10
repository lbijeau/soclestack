import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useOrganizations } from '../hooks/useOrganizations';
import type { Organization } from '@soclestack/core';

export interface OrganizationSwitcherProps {
  /** Custom trigger element */
  trigger?: ReactNode;
  /** Called after switching orgs */
  onSwitch?: (org: Organization) => void;
  /** Show "Create Organization" link */
  showCreateLink?: boolean;
  /** URL for create org link */
  createOrgUrl?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Dropdown component for switching between organizations
 *
 * @example
 * ```tsx
 * // Basic usage
 * <OrganizationSwitcher />
 *
 * // With custom trigger
 * <OrganizationSwitcher trigger={<Button>Switch Org</Button>} />
 *
 * // With callback
 * <OrganizationSwitcher onSwitch={(org) => router.push(`/org/${org.slug}`)} />
 * ```
 */
export function OrganizationSwitcher({
  trigger,
  onSwitch,
  showCreateLink = false,
  createOrgUrl = '/organizations/new',
  className,
}: OrganizationSwitcherProps) {
  const { organizations, currentOrganization, switchOrganization, isLoading } =
    useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSelect = async (org: Organization) => {
    if (org.id === currentOrganization?.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      const switched = await switchOrganization(org.id);
      setIsOpen(false);
      if (switched) onSwitch?.(switched);
    } finally {
      setIsSwitching(false);
    }
  };

  if (isLoading) return null;
  if (organizations.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className={className}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={isSwitching}
        style={trigger ? undefined : triggerStyles}
      >
        {trigger ?? <DefaultTrigger org={currentOrganization} />}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div role="menu" style={dropdownStyles}>
          {organizations.map((org) => (
            <OrgItem
              key={org.id}
              org={org}
              isSelected={org.id === currentOrganization?.id}
              onSelect={() => handleSelect(org)}
              disabled={isSwitching}
            />
          ))}
          {showCreateLink && (
            <a href={createOrgUrl} style={createLinkStyles}>
              + Create Organization
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-components

function DefaultTrigger({ org }: { org: Organization | null }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {org?.name ?? 'Select Organization'}
      <ChevronDown />
    </span>
  );
}

function OrgItem({
  org,
  isSelected,
  onSelect,
  disabled,
}: {
  org: Organization;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      disabled={disabled}
      style={{
        ...itemStyles,
        backgroundColor: isSelected ? '#f3f4f6' : 'transparent',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={orgNameStyles}>{org.name}</span>
      {org.role && <RoleBadge role={org.role} />}
      {isSelected && <CheckIcon />}
    </button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const label = role.replace('ROLE_', '').toLowerCase();
  const colors: Record<string, string> = {
    owner: '#7c3aed',
    admin: '#2563eb',
    member: '#6b7280',
  };
  return (
    <span
      style={{
        ...badgeStyles,
        backgroundColor: colors[label] ?? '#6b7280',
      }}
    >
      {label}
    </span>
  );
}

function ChevronDown() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ marginLeft: 4 }}
    >
      <path
        d="M4.5 6L8 9.5L11.5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ marginLeft: 'auto' }}
    >
      <path
        d="M13.5 4.5L6 12L2.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Styles
const triggerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: 14,
};

const dropdownStyles: CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  minWidth: 200,
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
  zIndex: 50,
  overflow: 'hidden',
};

const itemStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 14,
};

const orgNameStyles: CSSProperties = {
  fontWeight: 500,
};

const badgeStyles: CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 4,
  color: 'white',
  marginLeft: 8,
  textTransform: 'capitalize',
};

const createLinkStyles: CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  borderTop: '1px solid #e5e7eb',
  color: '#6366f1',
  textDecoration: 'none',
  fontSize: 14,
};
