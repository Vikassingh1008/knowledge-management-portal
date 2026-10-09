import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IPortalProperties, IPortalProps } from './models';
import { resolveSiteUrl } from './format';

export function buildPortalProps(
  context: WebPartContext,
  properties: IPortalProperties,
  activeNav: IPortalProps['activeNav']
): IPortalProps {
  const legacy = context.pageContext.legacyPageContext as { isSiteAdmin?: boolean } | undefined;
  return {
    siteUrl: resolveSiteUrl(properties.siteUrl || '', context.pageContext.web.absoluteUrl),
    spHttpClient: context.spHttpClient,
    userDisplayName: context.pageContext.user.displayName || '',
    userEmail: context.pageContext.user.email || '',
    isSiteAdmin: !!(legacy && legacy.isSiteAdmin),
    activeNav: activeNav,
    teamId: properties.teamId || '',
    channelId: properties.channelId || '',
    msGraphClientFactory: context.msGraphClientFactory
  };
}
