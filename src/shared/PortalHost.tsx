import * as React from 'react';
import { IPortalProps } from './models';
import { prefersReducedMotion } from './format';
import { PortalChrome } from './PortalChrome';
import { IPortalOpenDetail, PortalView } from './portalNav';

const DashboardView = React.lazy(() => import(/* webpackChunkName: 'dashboard-view' */ '../webparts/dashboardRepositoryWebPart/components/DashboardView').then((module) => ({ default: module.DashboardView })));
const KnowledgeRepository = React.lazy(() => import(/* webpackChunkName: 'knowledge-repository' */ '../webparts/knowledgeRepositoryWebPart/components/KnowledgeRepository').then((module) => ({ default: module.KnowledgeRepository })));
const KnowledgeAssistant = React.lazy(() => import(/* webpackChunkName: 'knowledge-assistant' */ './KnowledgeAssistant').then((module) => ({ default: module.KnowledgeAssistant })));

export interface IPortalHostProps {
  portal: IPortalProps;
}

function homeView(activeNav: IPortalProps['activeNav']): PortalView {
  if (activeNav === 'knowledge' || activeNav === 'assistant') {
    return activeNav;
  }
  return 'dashboard';
}

function scrollToSection(id: string): void {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const run = (): boolean => {
    if (!id || id === 'top') {
      window.scrollTo({ top: 0, behavior: behavior });
      return true;
    }
    const target = document.getElementById(id);
    if (!target) {
      return false;
    }
    target.scrollIntoView({ behavior: behavior, block: 'start' });
    return true;
  };
  window.setTimeout(() => {
    if (!run()) {
      window.setTimeout(run, 280);
    }
  }, 0);
}

export const PortalHost: React.FC<IPortalHostProps> = (props) => {
  const home = homeView(props.portal.activeNav);
  const [view, setView] = React.useState<PortalView>(home);

  React.useEffect(() => {
    const onOpen = (event: Event): void => {
      const detail = (event as CustomEvent).detail as IPortalOpenDetail | undefined;
      if (!detail || !detail.view) {
        return;
      }
      const target = document.getElementById('kmp-host-' + detail.view);
      const mine = document.getElementById('kmp-host-' + home);
      if (target && mine && target !== mine) {
        if (home === detail.view) {
          setView(detail.view);
        }
        target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        if (detail.scroll && home === detail.view) {
          scrollToSection(detail.scroll);
        }
        return;
      }
      if (detail.source && detail.source !== home) {
        return;
      }
      setView(detail.view);
      scrollToSection(detail.scroll || 'top');
    };
    window.addEventListener('kmp-open', onOpen);
    return () => window.removeEventListener('kmp-open', onOpen);
  }, [home]);

  const shown: IPortalProps = {
    siteUrl: props.portal.siteUrl,
    spHttpClient: props.portal.spHttpClient,
    userDisplayName: props.portal.userDisplayName,
    userEmail: props.portal.userEmail,
    isSiteAdmin: props.portal.isSiteAdmin,
    activeNav: view,
    teamId: props.portal.teamId,
    channelId: props.portal.channelId,
    msGraphClientFactory: props.portal.msGraphClientFactory
  };

  return (
    <div id={'kmp-host-' + home} data-kmp-host={home}>
      <PortalChrome portal={shown}>
        <React.Suspense fallback={<p role="status">Loading.</p>}>
          {view === 'dashboard' && <DashboardView portal={shown} framed={false} />}
          {view === 'knowledge' && <KnowledgeRepository portal={shown} framed={false} />}
          {view === 'assistant' && <KnowledgeAssistant portal={shown} />}
        </React.Suspense>
      </PortalChrome>
    </div>
  );
};
