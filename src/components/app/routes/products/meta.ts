export default {
  query: {
    category: { default: '', maxLength: 128, type: 'string' },
    order: { default: 'asc', enum: ['asc', 'desc'], type: 'string' },
    page: { default: 1, min: 1, type: 'integer' },
    q: { default: '', maxLength: 512, type: 'string' },
    sort: { default: 'title', enum: ['title', 'price', 'rating', 'stock'], type: 'string' },
  },
};
