import { Button } from 'react-aria-components'
import BulkPrice from '@/components/bulk-price'
import Catalogue from '@/components/catalogue'
import Keyboard from '@/components/keyboard'
import Lab from '@/components/lab'
import Language from '@/components/language'
import Detail from '@/components/product/detail'
import Editor from '@/components/product/editor'
import Remove from '@/components/product/remove'
import Session from '@/components/session'

export default ({ className, navigating, dialogs, brand, skip, world, askToSignIn, signInReason }) => (
  <div className={className} aria-busy={navigating}>
    <Button className="skip" onPress={() => document.getElementById('main')?.focus()}>
      {skip}
    </Button>
    <header>
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <h1>{brand}</h1>
        <span className="badge">{world}</span>
      </div>
      <Lab />
      <Language />
      <Keyboard />
      <Session asked={askToSignIn} reason={signInReason} />
    </header>
    <div className="progress" role="presentation" data-active={navigating || undefined} />
    <main id="main" tabIndex={-1}>
      <Catalogue />
    </main>
    {dialogs.view !== null && <Detail />}
    {dialogs.edit !== null && <Editor key={`edit-${dialogs.edit}`} />}
    {dialogs.create && <Editor key="create" />}
    {dialogs.remove !== null && <Remove key={dialogs.remove} />}
    {dialogs.bulk && <BulkPrice />}
  </div>
)
