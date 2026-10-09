import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IPortalProperties } from '../../shared/models';
import { fillCanvas } from '../../shared/format';
import { buildPortalProps } from '../../shared/portalContext';
import { portalPropertyPane } from '../../shared/propertyPane';
import { PortalHost } from '../../shared/PortalHost';

export default class KnowledgeRepositoryWebPartWebPart extends BaseClientSideWebPart<IPortalProperties> {
  public render(): void {
    fillCanvas(this.domElement);
    const element = React.createElement(PortalHost, {
      portal: buildPortalProps(this.context, this.properties, 'knowledge')
    });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return portalPropertyPane('Filter, sort, and open knowledge articles.');
  }
}
