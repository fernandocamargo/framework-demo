import { checkMicrodata, type Vocabulary } from './check';
import vocabulary from './vocabulary.json';

const check = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return checkMicrodata(vocabulary as Vocabulary, root);
};

test('a product, its offer and its rating, as schema.org names them, are right', () => {
  expect(
    check(`
      <li itemscope itemtype="https://schema.org/Product">
        <a itemprop="url" href="#/products?view=22"><span itemprop="name">Arc Floor Lamp</span></a>
        <span itemprop="brand" itemscope itemtype="https://schema.org/Brand"><span itemprop="name">Fieldwork</span></span>
        <span itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
          <data itemprop="ratingValue" value="4.2">4.2</data><meta itemprop="bestRating" content="5">
        </span>
        <span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <data itemprop="price" value="273.99">$273.99</data><meta itemprop="priceCurrency" content="USD">
          <link itemprop="availability" href="https://schema.org/InStock">
        </span>
      </li>`),
  ).toEqual([]);
});

test('names schema.org does not have, or a type does not take, are each said', () => {
  expect(
    check(`
      <li itemscope itemtype="https://schema.org/Product">
        <span itemprop="badge">Edited</span>
        <span itemprop="price">$1</span>
        <span itemprop="offers" itemscope itemtype="https://schema.org/Person"></span>
        <link itemprop="itemCondition" href="https://schema.org/InStock">
        <meta itemprop="sku">
      </li>
      <div itemtype="https://schema.org/Widget"></div>
      <span itemprop="name">Loose</span>
      <div itemscope itemtype="https://schema.org/LoginAction"></div>`),
  ).toEqual([
    '<div itemtype="https://schema.org/Widget">: an itemtype needs itemscope',
    '<div itemtype="https://schema.org/Widget">: schema.org has no type Widget',
    '<div itemscope itemtype="https://schema.org/LoginAction">: LoginAction is only pending in schema.org',
    '<span itemprop="badge">: schema.org has no property badge',
    '<span itemprop="price">: Product takes no price',
    '<span itemprop="offers" itemscope itemtype="https://schema.org/Person">: offers takes no Person',
    '<link itemprop="itemCondition">: itemCondition takes no ItemAvailability (InStock)',
    '<meta itemprop="sku">: a meta property needs content',
    '<span itemprop="name">: a property outside any item',
  ]);
});
