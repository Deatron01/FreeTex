import { Suspense, lazy, useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import { Spinner } from './components/ui.jsx';

const EditorPage = lazy(() => import('./components/EditorPage.jsx'));
import { useSettings } from './lib/settings.jsx';

// Hash based routing: "#/" is the project list, "#/project/<id>" the editor.
function parseHash() {
  const m = /^#\/project\/([^/?]+)/.exec(window.location.hash);
  return m ? { page: 'editor', id: decodeURIComponent(m[1]) } : { page: 'dashboard' };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const { lang } = useSettings();

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Re-mount on language change so every string is re-translated.
  if (route.page === 'editor') {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner size={28} /></div>}>
        <EditorPage key={`${route.id}-${lang}`} projectId={route.id} />
      </Suspense>
    );
  }
  return <Dashboard key={lang} />;
}
