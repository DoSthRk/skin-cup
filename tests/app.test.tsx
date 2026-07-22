import { render, screen } from '@testing-library/react';
import App from '../src/App';

it('shows the three launch weapons', () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: '皮肤之巅' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /狂徒.*42/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /幻影.*36/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /正义.*24/ })).toBeInTheDocument();
});
