import { type ReactNode, type CSSProperties } from 'react';
import { useInvite } from '../hooks/useInvite';
import type { Organization, Invite, InviteStatus } from '@soclestack/core';
import { LoadingSpinner } from './LoadingSpinner';

export interface InviteAcceptProps {
  /** The invite token from the URL */
  token: string;
  /** Called after successfully accepting the invite */
  onAccepted?: (org: Organization) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** URL to redirect to for login */
  loginUrl?: string;
  /** Return URL after login (defaults to /invite/{token}) */
  returnUrl?: string;
  /** Custom loading component */
  loadingFallback?: ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * Component for displaying and accepting organization invites
 *
 * @example
 * ```tsx
 * // Basic usage
 * <InviteAccept token={params.token} />
 *
 * // With callbacks
 * <InviteAccept
 *   token={token}
 *   onAccepted={(org) => router.push(`/org/${org.slug}`)}
 *   onError={(error) => toast.error(error.message)}
 * />
 * ```
 */
export function InviteAccept({
  token,
  onAccepted,
  onError,
  loginUrl = '/login',
  returnUrl,
  loadingFallback,
  className,
}: InviteAcceptProps) {
  const {
    invite,
    status,
    error,
    isLoading,
    isAccepting,
    isAuthenticated,
    accept,
  } = useInvite(token);

  const handleAccept = async () => {
    const org = await accept();
    if (org) {
      onAccepted?.(org);
    } else {
      // Note: error state updates asynchronously, so we provide a generic message
      // The hook's error state will be updated for display purposes
      onError?.(new Error('Failed to accept invite'));
    }
  };

  if (isLoading) {
    return <>{loadingFallback ?? <LoadingSpinner />}</>;
  }

  if (status !== 'valid' || !invite) {
    return <ErrorState status={status} error={error} />;
  }

  return (
    <div className={className} style={containerStyles}>
      <InviteCard invite={invite} />
      {isAuthenticated ? (
        <button
          type="button"
          onClick={handleAccept}
          disabled={isAccepting}
          style={{
            ...buttonStyles,
            opacity: isAccepting ? 0.7 : 1,
          }}
        >
          {isAccepting ? 'Joining...' : 'Accept Invite'}
        </button>
      ) : (
        <LoginPrompt loginUrl={loginUrl} returnUrl={returnUrl ?? `/invite/${token}`} />
      )}
    </div>
  );
}

// Sub-components

function InviteCard({ invite }: { invite: Invite }) {
  const roleLabel = invite.role.replace('ROLE_', '').toLowerCase();

  return (
    <div style={cardStyles}>
      <div style={headerStyles}>
        <OrgIcon />
        <h2 style={titleStyles}>{invite.organizationName}</h2>
      </div>
      <p style={descriptionStyles}>
        <strong>{invite.inviterName}</strong> has invited you to join as{' '}
        <RoleBadge role={roleLabel} />
      </p>
      <p style={emailStyles}>Invite sent to: {invite.email}</p>
    </div>
  );
}

function ErrorState({
  status,
  error,
}: {
  status: InviteStatus;
  error: string | null;
}) {
  const messages: Record<InviteStatus, { title: string; description: string }> =
    {
      loading: { title: 'Loading...', description: 'Please wait.' },
      valid: { title: 'Valid', description: 'Invite is valid.' },
      expired: {
        title: 'Invite Expired',
        description:
          'This invite has expired. Please ask for a new invitation.',
      },
      invalid: {
        title: 'Invalid Invite',
        description: 'This invite link is invalid or has been revoked.',
      },
      already_used: {
        title: 'Already Used',
        description: 'This invite has already been used.',
      },
      already_member: {
        title: 'Already a Member',
        description: "You're already a member of this organization.",
      },
    };

  const { title, description } = messages[status] ?? {
    title: 'Error',
    description: error ?? 'Something went wrong.',
  };

  return (
    <div style={errorContainerStyles}>
      <ErrorIcon />
      <h3 style={errorTitleStyles}>{title}</h3>
      <p style={errorDescriptionStyles}>{description}</p>
    </div>
  );
}

function LoginPrompt({ loginUrl, returnUrl }: { loginUrl: string; returnUrl: string }) {
  const encodedReturnUrl = encodeURIComponent(returnUrl);
  const href = `${loginUrl}?returnUrl=${encodedReturnUrl}`;

  return (
    <div style={loginPromptStyles}>
      <p style={loginTextStyles}>Please sign in to accept this invite.</p>
      <a href={href} style={loginLinkStyles}>
        Sign In
      </a>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: '#7c3aed',
    admin: '#2563eb',
    member: '#6b7280',
  };

  return (
    <span
      style={{
        ...badgeStyles,
        backgroundColor: colors[role] ?? '#6b7280',
      }}
    >
      {role}
    </span>
  );
}

function OrgIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginRight: 8 }}
    >
      <path
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      style={{ marginBottom: 16, color: '#ef4444' }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8v4m0 4h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Styles

const containerStyles: CSSProperties = {
  maxWidth: 400,
  margin: '0 auto',
  padding: 24,
};

const cardStyles: CSSProperties = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

const headerStyles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 16,
};

const titleStyles: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 600,
};

const descriptionStyles: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 14,
  color: '#374151',
};

const emailStyles: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: '#6b7280',
};

const buttonStyles: CSSProperties = {
  width: '100%',
  padding: '12px 24px',
  backgroundColor: '#6366f1',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  fontSize: 16,
  fontWeight: 500,
  cursor: 'pointer',
};

const badgeStyles: CSSProperties = {
  display: 'inline-block',
  fontSize: 12,
  padding: '2px 8px',
  borderRadius: 4,
  color: 'white',
  textTransform: 'capitalize',
  verticalAlign: 'middle',
};

const errorContainerStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: 32,
  textAlign: 'center',
};

const errorTitleStyles: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 18,
  fontWeight: 600,
  color: '#111827',
};

const errorDescriptionStyles: CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: '#6b7280',
};

const loginPromptStyles: CSSProperties = {
  textAlign: 'center',
  padding: 16,
  backgroundColor: '#fffbeb',
  border: '1px solid #fcd34d',
  borderRadius: 8,
};

const loginTextStyles: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 14,
  color: '#92400e',
};

const loginLinkStyles: CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  backgroundColor: '#6366f1',
  color: 'white',
  textDecoration: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 500,
};
