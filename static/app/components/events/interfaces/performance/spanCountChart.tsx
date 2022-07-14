import {useState} from 'react';
import maxBy from 'lodash/maxBy';

import {BarChart} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import LoadingPanel from 'sentry/components/charts/loadingPanel';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DateString} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';
import theme from 'sentry/utils/theme';

export function SpanCountChart({issue, event, location, organization}: any) {
  const [zoomError, setZoomError] = useState(false);

  // const transactionName = event.culprit;
  // const allEventsQuery = `event.type:transaction transaction:${transactionName}`;
  const allEventsQuery = 'event.type:transaction';
  const [now] = useState<DateString>(new Date());

  const query = allEventsQuery;
  const start = issue.firstSeen;
  const end = now;
  const environment = [];
  const project = [];

  function handleMouseOver() {
    // Hide the zoom error tooltip on the next hover.
    if (zoomError) {
      setZoomError(false);
    }
  }

  function renderChart(data: HistogramData) {
    const xAxis = {
      type: 'category' as const,
      truncate: true,
      axisTick: {
        interval: 5,
        alignWithLabel: true,
      },
    };

    const colors = [theme.charts.previousPeriod, '#444674'];
    console.log(colors);
    // Use a custom tooltip formatter as we need to replace
    // the tooltip content entirely when zooming is no longer available.
    const tooltip = {
      formatter(series) {
        const seriesData = Array.isArray(series) ? series : [series];
        let contents: string[] = [];
        if (!zoomError) {
          // Replicate the necessary logic from sentry/components/charts/components/tooltip.jsx
          contents = seriesData.map(item => {
            const label = item.seriesName;
            const value = item.value[1].toLocaleString();
            return [
              '<div class="tooltip-series">',
              `<div><span class="tooltip-label">${item.marker} <strong>${label}</strong></span> ${value}</div>`,
              '</div>',
            ].join('');
          });
          const seriesLabel = seriesData[0].value[0];
          contents.push(`<div class="tooltip-date">${seriesLabel}</div>`);
        } else {
          contents = [
            '<div class="tooltip-series tooltip-series-solo">',
            t('Target zoom region too small'),
            '</div>',
          ];
        }
        contents.push('<div class="tooltip-arrow"></div>');
        return contents.join('');
      },
    };

    const series = {
      seriesName: t('All Events'),
      data: formatHistogramData(data, {type: 'number'}),
    };

    const fakeSeries = _series => {
      return {
        seriesName: 'Affected Events',
        data: _series.data.map(point => ({
          name: (parseInt(point.name, 10) + 8).toString(),
          value: parseInt(point.value * 0.25, 10),
        })),
      };
    };

    return (
      <BarChartZoom
        minZoomWidth={100}
        location={location}
        paramStart="min"
        paramEnd="max"
        xAxisIndex={[0]}
        buckets={computeBuckets(data)}
        onDataZoomCancelled={() => setZoomError(true)}
      >
        {zoomRenderProps => (
          <BarChart
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
            xAxis={xAxis}
            yAxis={{type: 'value'}}
            series={[series, fakeSeries(series)]}
            tooltip={tooltip}
            colors={colors}
            onMouseOver={handleMouseOver}
            {...zoomRenderProps}
          />
        )}
      </BarChartZoom>
    );
  }

  const eventView = EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: '',
      fields: ['transaction.duration'],
      projects: project,
      query,
      environment,
      start,
      end,
    },
    location
  );

  const field = 'transaction.duration';

  return (
    <HistogramQuery
      location={location}
      orgSlug={organization.slug}
      eventView={eventView}
      numBuckets={100}
      fields={[field]}
      dataFilter="exclude_outliers"
    >
      {({histograms, isLoading, error}) => {
        if (isLoading) {
          return <LoadingPanel data-test-id="histogram-loading" />;
        }

        if (error) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return renderChart(histograms?.[field] ?? []);
      }}
    </HistogramQuery>
  );
}
