import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import FullmindClassroom from './fullmind-classroom/component';

// BBB injects this <script> with a `uuid` attribute and has already created a
// <div id={uuid}> in its React tree for us to mount into. This entrypoint pattern
// follows the official template. (BBB also passes a `pluginName` attribute; read
// it here if a future feature needs it.)
const uuid = document.currentScript?.getAttribute('uuid') || 'root';

const root = ReactDOM.createRoot(document.getElementById(uuid));
root.render(<FullmindClassroom pluginUuid={uuid} />);
