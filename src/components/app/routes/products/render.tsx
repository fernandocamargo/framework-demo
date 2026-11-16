import Catalogue from './components/catalogue';

export default ({ filters, routes, settings }) => (
  <>
    <Catalogue filters={filters} settings={settings} />
    {routes}
  </>
);
