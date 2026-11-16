// Shell settings travel in every address; page query fields belong to their route.
export default {
  home: '/products',
  query: {
    lang: { default: '', enum: ['', 'en', 'pt-BR'], type: 'string' },
    signin: { default: false, type: 'boolean' },
    skin: { default: 'default', enum: ['default', 'broadsheet', 'blueprint'], type: 'string' },
    world: { default: 'dummyjson', enum: ['dummyjson', 'memory'], type: 'string' },
  },
};
