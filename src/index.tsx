import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import FullmindClassroom from './fullmind-classroom/component';

// BBB injects this <script> with `uuid` + `pluginName` attributes and has already
// created a <div id={uuid}> in its React tree for us to mount into. This entrypoint
// pattern is taken verbatim from the official template — don't change it.
const uuid = document.currentScript?.getAttribute('uuid') || 'root';
const pluginName = document.currentScript?.getAttribute('pluginName') || 'plugin';

const root = ReactDOM.createRoot(document.getElementById(uuid));
root.render(
  <FullmindClassroom {...{
    pluginUuid: uuid,
    pluginName,
  }}
  />,
);
