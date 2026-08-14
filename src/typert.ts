/** Host-side Typert contribution loaded through the package's `./typert` export. */

import { descriptors } from './remote.ts'

export const TYPERT = {
  package: 'dsh-writing-pad',
  face: 'host',
  schemas: [],
  invocations: descriptors,
  model: {
    services: [],
    events: [],
    objects: [],
  },
}

export default TYPERT
