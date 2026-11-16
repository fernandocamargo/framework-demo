export default {
  query: {
    page: { default: 1, min: 1, type: 'integer' },
    region: { default: '', maxLength: 2, pattern: '^[A-Z]{0,2}$', type: 'string' },
  },
};
