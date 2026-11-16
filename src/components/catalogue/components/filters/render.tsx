// The catalogue's search, as the platform marks one and as schema.org names it: an action on the
// catalogue around it, with the words it searches for.
export default ({ categories, category, className, handlers, i18n, q, sort, sorts, text }) => (
  <search className={className} itemProp="potentialAction" itemScope itemType="https://schema.org/SearchAction">
    <meta content={q} itemProp="query" />
    {/* The form's text follows the address without replacing the field or its focus. */}
    <form onReset={handlers.clearSearch} onSubmit={handlers.search}>
      <input
        aria-label={i18n.search.label}
        name="q"
        onChange={handlers.setSearch}
        onKeyDown={handlers.searchKey}
        placeholder={i18n.search.placeholder}
        type="search"
        value={text}
      />
      <button
        aria-label={i18n.search.clear}
        hidden={!text}
        onPointerDown={handlers.keepSearchFocus}
        tabIndex={-1}
        type="reset"
      />
    </form>
    <select aria-label={i18n.category.label} onChange={handlers.pickCategory} value={category}>
      <button>
        <selectedcontent />
      </button>
      {categories.map((item) => (
        <option key={item.slug} value={item.slug}>
          {item.name}
        </option>
      ))}
    </select>
    <select aria-label={i18n.sort.label} onChange={handlers.pickSort} value={sort}>
      <button>
        <selectedcontent />
      </button>
      {sorts.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  </search>
);
