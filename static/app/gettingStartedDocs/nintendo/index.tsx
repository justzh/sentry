import ExternalLink from 'sentry/components/links/externalLink';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  Docs,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

type Params = DocsParams;

const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      description: tct(
        'Download the SDK and follow the instructions that are provided in the [nintendoDoc:Nintendo Developer documentation].',
        {
          nintendoDoc: (
            // TODO: @athena replace with the actual link
            <ExternalLink href="https://developer.nintendo.com/" />
          ),
        }
      ),
    },
  ],
  configure: (_params: Params) => [],
  verify: () => [],
};

const docs: Docs = {
  onboarding,
};

export default docs;
