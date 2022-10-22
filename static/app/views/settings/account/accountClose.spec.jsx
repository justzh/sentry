import {Organization} from 'fixtures/js-stubs/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import AccountClose from 'sentry/views/settings/account/accountClose';

describe('AccountClose', function () {
  let deleteMock;
  const soloOrgSlug = 'solo-owner';
  const nonSingleOwnerSlug = 'non-single-owner';

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/?owner=1',
      body: [
        {
          organization: Organization({
            slug: soloOrgSlug,
          }),
          singleOwner: true,
        },
        {
          organization: Organization({
            id: '4',
            slug: nonSingleOwnerSlug,
          }),
          singleOwner: false,
        },
      ],
    });

    deleteMock = MockApiClient.addMockResponse({
      url: '/users/me/',
      method: 'DELETE',
    });
  });

  it('lists all orgs user is an owner of', function () {
    render(<AccountClose />);
    renderGlobalModal();

    // Input for single owner org
    const singleOwner = screen.getByRole('checkbox', {name: soloOrgSlug});
    expect(singleOwner).toBeChecked();
    expect(singleOwner).toBeDisabled();

    // Input for non-single-owner org
    const nonSingleOwner = screen.getByRole('checkbox', {name: nonSingleOwnerSlug});
    expect(nonSingleOwner).not.toBeChecked();
    expect(nonSingleOwner).toBeEnabled();

    // Can check 2nd org
    userEvent.click(nonSingleOwner);
    expect(nonSingleOwner).toBeChecked();

    // Delete
    userEvent.click(screen.getByRole('button', {name: 'Close Account'}));

    // First button is cancel, target Button at index 2
    expect(
      screen.getByText(
        'This is permanent and cannot be undone, are you really sure you want to do this?'
      )
    ).toBeInTheDocument();
    userEvent.click(screen.getByText('Confirm'));

    expect(deleteMock).toHaveBeenCalledWith(
      '/users/me/',
      expect.objectContaining({
        data: {
          organizations: [soloOrgSlug, nonSingleOwnerSlug],
        },
      })
    );
  });
});
