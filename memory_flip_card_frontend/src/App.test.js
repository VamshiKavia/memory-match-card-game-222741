import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app title', () => {
  render(<App />);
  const title = screen.getByText(/Memory Match/i);
  expect(title).toBeInTheDocument();
});

test('renders controls and board status', () => {
  render(<App />);
  // buttons for size
  expect(screen.getByRole('button', { name: /4 x 4/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /6 x 6/i })).toBeInTheDocument();
  // reset button
  expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
});
