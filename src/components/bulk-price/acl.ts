// Who may apply a bulk price change, and how large: the backend grants price updates, and says
// the largest change each person may apply (null for no limit). The rule reads the form too, so
// its decision changes as the percentage is typed. A guest may still try, and is asked to sign in.
export default ({ acl, form }) =>
  acl.role === 'guest' || (acl.grants.prices.includes('update') && (acl.limits.priceChange === null || form.values.percent <= acl.limits.priceChange))
