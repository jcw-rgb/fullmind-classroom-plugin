import { useEffect } from 'react';
import { BbbPluginSdk, PluginApi, pluginLogger } from 'bigbluebutton-html-plugin-sdk';
import { makeSessionProgressWindow } from '../session-progress-bar';
import { makeLessonHubWindow } from './lesson-hub-rail';
import { makeMiniLessonPromptWindow } from './mini-lesson-prompt';

/**
 * Floating-windows hub — the SINGLE caller of setFloatingWindows. Every overlay
 * (progress band + Lesson Hub rail + mini-lesson prompt) must register in one call,
 * because set* is last-writer-wins per plugin. Renders no DOM of its own.
 */
function RegisterFloatingWindows({ pluginUuid }: { pluginUuid: string }): null {
  BbbPluginSdk.initialize(pluginUuid);
  const pluginApi: PluginApi = BbbPluginSdk.getPluginApi(pluginUuid);

  useEffect(() => {
    pluginLogger.info('[Fullmind] Registering floating windows: progress band + Lesson Hub rail + mini-lesson prompt.');
    pluginApi.setFloatingWindows([
      makeSessionProgressWindow(pluginUuid),
      makeLessonHubWindow(pluginUuid),
      makeMiniLessonPromptWindow(pluginUuid),
    ]);
  }, []);

  return null;
}

export default RegisterFloatingWindows;
