import { IPropertyPaneConfiguration, PropertyPaneTextField } from '@microsoft/sp-property-pane';

export function portalPropertyPane(title: string): IPropertyPaneConfiguration {
  return {
    pages: [
      {
        header: { description: title },
        groups: [
          {
            groupName: 'Knowledge Management Portal',
            groupFields: [
              PropertyPaneTextField('siteUrl', {
                label: 'SharePoint site URL',
                description: 'https://holidaywiser.sharepoint.com/sites/KnowledgeManagementPortal'
              }),
              PropertyPaneTextField('teamId', {
                label: 'Teams team id',
                description: 'Used to post adaptive cards. Leave blank to skip Teams.'
              }),
              PropertyPaneTextField('channelId', {
                label: 'Teams channel id',
                description: 'Channel that receives article announcements and approval requests.'
              })
            ]
          }
        ]
      }
    ]
  };
}
