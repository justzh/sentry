import {uuid4} from '@sentry/utils';

import type {DetailedTeam as TeamType} from 'sentry/types';

export function TeamFixture(params: Partial<TeamType> = {}): TeamType {
  return {
    id: '1',
    slug: 'team-slug',
    name: 'Team Name',
    access: ['team:read'],
    orgRole: undefined, // TODO(cathy): Rename this
    teamRole: null,
    isMember: true,
    memberCount: 0,
    avatar: {avatarType: 'letter_avatar', avatarUuid: uuid4()},
    flags: {
      'idp:provisioned': false,
    },
    externalTeams: [],
    projects: [],
    hasAccess: false,
    isPending: false,
    ...params,
  };
}

// TODO(@gggritso): Remove this once the imports in `getsentry` are up-to-date
export {TeamFixture as Team};
