import { useEffect } from 'react';
import { BbbPluginSdk, PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { makeChatArea } from './chat-panel';
import { makeNotesArea } from './notes-panel';
import { makeClassArea } from './class-panel';

/**
 * Panel hub — registers the three Fullmind sidebar panels in ONE
 * setGenericContentItems call. Required because set* setters are last-writer-wins
 * per plugin: if each panel called setGenericContentItems itself, only the last
 * would survive. Renders no DOM of its own.
 */
function RegisterPanels({ pluginUuid }: { pluginUuid: string }): null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  useEffect(() => {
    pluginLogger.info('[Fullmind] Registering sidebar panels: Chat, Notes, Class.');
    pluginApi.setGenericContentItems([
      makeChatArea(pluginUuid),
      makeNotesArea(pluginUuid),
      makeClassArea(pluginUuid),
    ]);
    // Register once for the component's life (pluginApi is a stable singleton
    // keyed by uuid on window); re-running would thrash the registration.
  }, []);

  return null;
}

export default RegisterPanels;
