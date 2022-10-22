import {DetailedEvents} from 'fixtures/js-stubs/detailedEvents';

import {render} from 'sentry-test/reactTestingLibrary';

import EventsTable from 'sentry/components/eventsTable/eventsTable';

describe('EventsTable', function () {
  it('renders', function () {
    const {container} = render(
      <EventsTable
        tagList={[]}
        orgId="orgId"
        projectId="projectId"
        groupId="groupId"
        events={DetailedEvents()}
      />
    );
    expect(container).toSnapshot();
  });
});
