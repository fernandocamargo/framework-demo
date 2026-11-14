// Storybook's stage for the app's components: every story renders inside the app's `Root`, as the
// shell (src/main.tsx) renders the page, in the memory world, with the page's styles. Two
// toolbars: the page's language, and who is signed in, signed in for real with that role's demo
// account before the story renders, so the session, what may be done and the flags agree. A story
// starts at the address its example names, and then follows its links, as the app does.

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'
import { I18nProvider } from 'react-aria-components'
import { Root, type Env, type Navigation, type Route } from 'framework'
import { format, go, HOME, parse } from '../src/address'
import memory from '../src/clients/memory'
import { DEMOS } from '../src/components/session/form'
import { LOCALES } from '../src/locales'
import { featureFlags, permissions, whoIsSignedIn } from '../src/reads'
import '../src/base.css'

const env: Env = { world: 'memory', apiUrl: 'https://dummyjson.com' }
const entity = { id: 'memory' }
const navigation: Navigation = { go }

// The memory world's API client: the session it keeps is the one every story's `Root` reads.
const api = memory({ env } as never)
async function signInAs(role: string) {
  const demo = DEMOS.find((account) => account.role === role)
  const current = api.session.current()
  if (!demo) return void (current && api.session.signOut())
  if (current?.user.username === demo.username) return
  await api.session.signIn({ username: demo.username, password: demo.password })
}

/** The address: the story's example first, then wherever its links and `navigation.go` take it. */
function Stage({ start, children }: { start: Partial<Route> | undefined; children: (route: Route) => ReactNode }) {
  const [hash, setHash] = useState(() => format({ ...HOME, ...start }))
  const [, navigate] = useTransition()
  useEffect(() => {
    window.location.hash = hash
    const follow = () => navigate(() => setHash(window.location.hash))
    window.addEventListener('hashchange', follow)
    return () => window.removeEventListener('hashchange', follow)
    // The story's own address, once, when it mounts.
  }, [])
  const route = useMemo(() => parse(hash), [hash])
  return children(route)
}

const inRoot: Decorator = (Story, context) => {
  const { locale, role } = context.globals as { locale: (typeof LOCALES)[number]; role: string }
  const start = (context.parameters['framework'] as { route?: Partial<Route> } | undefined)?.route
  return (
    <I18nProvider locale={locale}>
      <Stage start={start}>
        {(route) => (
          // A new Root for each person, so its reads start over for them.
          <Root key={role} env={env} entity={entity} route={route} navigation={navigation} locale={locale} user={whoIsSignedIn} acl={permissions} flags={featureFlags}>
            <Story />
          </Root>
        )}
      </Stage>
    </I18nProvider>
  )
}

export default {
  decorators: [inRoot],
  loaders: [({ globals }) => signInAs(globals['role'] as string)],
  globalTypes: {
    locale: {
      description: "The page's language",
      toolbar: { title: 'Language', icon: 'globe', dynamicTitle: true, items: LOCALES.map((value) => ({ value, title: value === 'en' ? 'English' : 'Português (Brasil)' })) },
    },
    role: {
      description: 'Who is signed in',
      toolbar: {
        title: 'Signed in as',
        icon: 'user',
        dynamicTitle: true,
        items: [{ value: 'guest', title: 'Nobody' }, ...DEMOS.map(({ name, role }) => ({ value: role, title: `${name}, ${role}` }))],
      },
    },
  },
  initialGlobals: { locale: 'en', role: 'guest' },
  parameters: {
    layout: 'padded',
    // Each story of a docs page in a frame of its own: a story's address, its dialogs and its keys
    // stay its own.
    docs: { story: { inline: false, height: '480px' } },
  },
} satisfies Preview
