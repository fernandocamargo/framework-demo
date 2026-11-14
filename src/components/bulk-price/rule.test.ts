import { newPrice, ruleProblem } from './rule';

test('a rule moves a price by its percentage, to the cent', () => {
  expect(newPrice(220.99, { direction: 'decrease', percent: 20 })).toBe(176.79);
  expect(newPrice(19.99, { direction: 'increase', percent: 10 })).toBe(21.99);
});

test('no price goes below one cent', () => {
  expect(newPrice(0.02, { direction: 'decrease', percent: 99 })).toBe(0.01);
});

test('a rule that cannot be applied says why', () => {
  expect(ruleProblem({ direction: 'decrease', percent: 0 })).toBe('none');
  expect(ruleProblem({ direction: 'decrease', percent: 100 })).toBe('decreaseTooLarge');
  expect(ruleProblem({ direction: 'increase', percent: 100 })).toBeNull();
});
