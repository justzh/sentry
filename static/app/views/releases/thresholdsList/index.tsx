import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Environment, Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {TOTAL_ERROR_COUNT_STR} from 'sentry/views/releases/utils/constants';

import Header from '../components/header';
import type {Threshold} from '../utils/types';
import useFetchThresholdsListData from '../utils/useFetchThresholdsListData';

import NoThresholdCard from './noThresholdCard';
import ThresholdGroupTable from './thresholdGroupTable';

type Props = {};

function ReleaseThresholdList({}: Props) {
  const [listError, setListError] = useState<string>('');
  const [newProjThresholdsPage, setNewProjThresholdsPage] = useState(0);
  const PAGE_SIZE = 10;
  const router = useRouter();
  const organization = useOrganization();

  useEffect(() => {
    const hasV2ReleaseUIEnabled =
      organization.features.includes('releases-v2-internal') ||
      organization.features.includes('releases-v2') ||
      organization.features.includes('releases-v2-st');
    if (!hasV2ReleaseUIEnabled) {
      const redirect = normalizeUrl(`/organizations/${organization.slug}/releases/`);
      router.replace(redirect);
    }
  }, [router, organization]);

  const isActivatedAlert = organization.features.includes('activated-alert-rules');

  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const {
    data: thresholdAndAlerts = [],
    error: requestError,
    isLoading,
    isError,
    refetch,
  } = useFetchThresholdsListData({
    selectedProjectIds: selection.projects,
    selectedEnvs: selection.environments,
  });

  const thresholds: Threshold[] = useMemo(() => {
    if (!isActivatedAlert) return thresholds;

    return thresholdAndAlerts.map((thresholdOrRule: Threshold | MetricRule) => {
      const rule = thresholdOrRule as MetricRule;

      return {
        date_added: rule.dateCreated,
        environment: {
          name: rule.environment,
          displayName: rule.environment,
        } as Environment,
        id: rule.id,
        project: {id: rule.projects[0], slug: rule.projects[0]},
        threshold_type: TOTAL_ERROR_COUNT_STR,
        trigger_type: 'over',
        value: rule.triggers[0]?.alertThreshold,
        window_in_seconds: rule.timeWindow,
      } as Threshold;
    });
  }, [isActivatedAlert, thresholdAndAlerts]);

  const selectedProjects: Project[] = useMemo(
    () =>
      projects.filter(
        project =>
          selection.projects.some(id => {
            const strId = String(id);
            return strId === project.id || id === -1;
          }) || !selection.projects.length
      ),
    [projects, selection.projects]
  );

  const projectsById: {[key: string]: Project} = useMemo(() => {
    const byId = {};
    selectedProjects.forEach(proj => {
      byId[proj.id] = proj;
      // adding slug for migration to MetricAlerts, we only have slug in MetricAlerts
      byId[proj.slug] = proj;
    });
    return byId;
  }, [selectedProjects]);

  const getAllEnvironmentNames = useMemo((): string[] => {
    const selectedProjectIds = selection.projects.map(id => String(id));
    const {user} = ConfigStore.getState();
    const allEnvSet = new Set(projects.flatMap(project => project.environments));
    // NOTE: mostly taken from environmentSelector.tsx
    const unSortedEnvs = new Set(
      projects.flatMap(project => {
        /**
         * Include environments from:
         * all projects I can access if -1 is the only selected project.
         * all member projects if 'my projects' (empty list) is selected.
         * all projects if the user is a superuser
         * the requested projects
         */
        const allProjectsSelectedICanAccess =
          selectedProjectIds.length === 1 &&
          selectedProjectIds[0] === String(ALL_ACCESS_PROJECTS) &&
          project.hasAccess;
        const myProjectsSelected = selectedProjectIds.length === 0 && project.isMember;
        const allMemberProjectsIfSuperuser =
          selectedProjectIds.length === 0 && user.isSuperuser;
        if (
          allProjectsSelectedICanAccess ||
          myProjectsSelected ||
          allMemberProjectsIfSuperuser ||
          selectedProjectIds.includes(project.id)
        ) {
          return project.environments;
        }

        return [];
      })
    );
    const envDiff = new Set([...allEnvSet].filter(x => !unSortedEnvs.has(x)));

    // bubble the selected projects envs first, then concat the rest of the envs
    return Array.from(unSortedEnvs)
      .sort()
      .concat([...envDiff].sort());
  }, [projects, selection.projects]);

  const getEnvironmentsAvailableToProject = useMemo((): string[] => {
    const selectedProjectIds = selection.projects.map(id => String(id));
    const allEnvSet = new Set(projects.flatMap(project => project.environments));
    // NOTE: mostly taken from environmentSelector.tsx
    const unSortedEnvs = new Set(
      projects.flatMap(project => {
        /**
         * Include environments from:
         * all projects if -1 is the only selected project.
         * all member projects if 'my projects' (empty list) is selected.
         * the requested projects
         */
        const allProjectsSelected =
          selectedProjectIds.length === 1 &&
          selectedProjectIds[0] === String(ALL_ACCESS_PROJECTS) &&
          project.hasAccess;
        const myProjectsSelected = selectedProjectIds.length === 0 && project.isMember;
        if (
          allProjectsSelected ||
          myProjectsSelected ||
          selectedProjectIds.includes(project.id)
        ) {
          return project.environments;
        }

        return [];
      })
    );
    const envDiff = new Set([...allEnvSet].filter(x => !unSortedEnvs.has(x)));

    // bubble the selected projects envs first, then concat the rest of the envs
    return Array.from(unSortedEnvs)
      .sort()
      .concat([...envDiff].sort());
  }, [projects, selection.projects]);

  /**
   * Thresholds filtered by environment selection
   * NOTE: currently no way to filter for 'None' environments
   */
  const filteredThresholds = selection.environments.length
    ? thresholds.filter(threshold => {
        return threshold.environment?.name
          ? selection.environments.indexOf(threshold.environment.name) > -1
          : !selection.environments.length;
      })
    : thresholds;

  const thresholdsByProject: {[key: string]: Threshold[]} = useMemo(() => {
    const byProj = {};

    filteredThresholds.forEach(threshold => {
      const selectedProject = selection.projects[0] !== -1 ? selection.projects[0] : null;
      const projId = threshold.project.id ?? selectedProject;
      (byProj[projId] ??= []).push(threshold);
    });
    return byProj;
  }, [filteredThresholds, selection.projects]);

  const projectsWithoutThresholds: Project[] = useMemo(() => {
    // TODO: limit + paginate list
    return selectedProjects.filter(
      proj => !thresholdsByProject[proj.id] && !thresholdsByProject[proj.slug]
    );
  }, [thresholdsByProject, selectedProjects]);

  const setTempError = msg => {
    setListError(msg);
    setTimeout(() => setListError(''), 5000);
  };

  if (isError) return <LoadingError onRetry={refetch} message={requestError.message} />;
  if (isLoading) return <LoadingIndicator />;

  return (
    <PageFiltersContainer>
      <NoProjectMessage organization={organization}>
        <Header router={router} hasV2ReleaseUIEnabled organization={organization} />
        <Layout.Body>
          <Layout.Main fullWidth>
            <FilterRow>
              <ReleaseThresholdsPageFilterBar condensed>
                <GuideAnchor target="release_projects">
                  <ProjectPageFilter />
                </GuideAnchor>
                <EnvironmentPageFilter />
              </ReleaseThresholdsPageFilterBar>
              <ListError>{listError}</ListError>
            </FilterRow>
            {thresholdsByProject &&
              Object.entries(thresholdsByProject).map(([projId, thresholdsByProj]) => (
                <ThresholdGroupTable
                  key={projId}
                  project={projectsById[projId]}
                  thresholds={thresholdsByProj}
                  isLoading={isLoading}
                  isError={isError}
                  refetch={refetch}
                  setTempError={setTempError}
                  allEnvironmentNames={getEnvironmentsAvailableToProject}
                />
              ))}
            {projectsWithoutThresholds.length > 0 && (
              <div>
                <strong>Projects without Thresholds</strong>
                {projectsWithoutThresholds
                  .slice(
                    PAGE_SIZE * newProjThresholdsPage,
                    PAGE_SIZE * newProjThresholdsPage + PAGE_SIZE
                  )
                  .map(proj => (
                    <NoThresholdCard
                      key={proj.id}
                      project={proj}
                      allEnvironmentNames={getAllEnvironmentNames}
                      refetch={refetch}
                      setTempError={setTempError}
                    />
                  ))}
                <Paginator>
                  <Button
                    icon={<IconChevron direction="left" size="sm" />}
                    aria-label={t('Previous')}
                    size="sm"
                    disabled={newProjThresholdsPage === 0}
                    onClick={() => {
                      setNewProjThresholdsPage(newProjThresholdsPage - 1);
                    }}
                  />
                  <CurrentPage>
                    {newProjThresholdsPage + 1} of{' '}
                    {Math.ceil(projectsWithoutThresholds.length / PAGE_SIZE)}
                  </CurrentPage>
                  <Button
                    icon={<IconChevron direction="right" size="sm" />}
                    aria-label={t('Next')}
                    size="sm"
                    disabled={
                      PAGE_SIZE * newProjThresholdsPage + PAGE_SIZE >=
                      projectsWithoutThresholds.length
                    }
                    onClick={() => {
                      setNewProjThresholdsPage(newProjThresholdsPage + 1);
                    }}
                  />
                </Paginator>
              </div>
            )}
          </Layout.Main>
        </Layout.Body>
      </NoProjectMessage>
    </PageFiltersContainer>
  );
}

export default ReleaseThresholdList;

const FilterRow = styled('div')`
  display: flex;
  align-items: center;
`;

const ListError = styled('div')`
  color: red;
  margin: 0 ${space(2)};
  width: 100%;
  display: flex;
  justify-content: center;
`;

const ReleaseThresholdsPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const Paginator = styled('div')`
  margin: ${space(2)} 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
`;

const CurrentPage = styled('div')`
  margin: 0 ${space(1)};
`;
