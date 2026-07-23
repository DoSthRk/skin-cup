import { act, fireEvent, render, screen } from '@testing-library/react';
import { CreatorFooter } from '../src/components/CreatorFooter';

it('shows Clint attribution and reveals the supplied profile details on click', () => {
  render(<CreatorFooter />);

  const trigger = screen.getByRole('button', {
    name: '查看作者 Clint 的个人信息',
  });
  expect(screen.getByText('MADE BY')).toBeInTheDocument();
  expect(screen.getByText('Clint')).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(
    screen.queryByRole('region', { name: '作者 Clint 的个人信息' }),
  ).not.toBeInTheDocument();

  fireEvent.click(trigger);

  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('img', { name: 'Clint 的头像' }),
  ).toHaveAttribute('src', '/creator/clint-avatar.png');
  expect(
    screen.getByRole('link', { name: 'GitHub · @DoSthRk' }),
  ).toHaveAttribute('href', 'https://github.com/DoSthRk');
  expect(
    screen.getByRole('img', { name: 'Clint 的微信二维码' }),
  ).toHaveAttribute('src', '/creator/clint-wechat.jpg');
  expect(screen.getByText('微信联系')).toBeInTheDocument();
  expect(screen.queryByText(/VALORANT ID/i)).not.toBeInTheDocument();
});

it('opens on hover and closes with Escape', () => {
  render(<CreatorFooter />);

  const trigger = screen.getByRole('button', {
    name: '查看作者 Clint 的个人信息',
  });
  const profile = trigger.parentElement!;

  fireEvent.mouseEnter(profile);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');

  fireEvent.keyDown(profile, { key: 'Escape' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('opens on the first pointer click without focus cancelling the toggle', () => {
  render(<CreatorFooter />);

  const trigger = screen.getByRole('button', {
    name: '查看作者 Clint 的个人信息',
  });

  fireEvent.pointerDown(trigger);
  act(() => trigger.focus());
  fireEvent.click(trigger);

  expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

it('still opens from keyboard focus after interacting with the GitHub link', () => {
  render(<CreatorFooter />);

  const trigger = screen.getByRole('button', {
    name: '查看作者 Clint 的个人信息',
  });
  const profile = trigger.parentElement!;
  fireEvent.click(trigger);

  fireEvent.pointerDown(
    screen.getByRole('link', { name: 'GitHub · @DoSthRk' }),
  );
  fireEvent.mouseLeave(profile);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  fireEvent.focus(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
});

it('keeps the card open while keyboard focus remains inside the profile', () => {
  render(<CreatorFooter />);

  const trigger = screen.getByRole('button', {
    name: '查看作者 Clint 的个人信息',
  });
  const profile = trigger.parentElement!;

  act(() => trigger.focus());
  fireEvent.mouseLeave(profile);

  expect(trigger).toHaveAttribute('aria-expanded', 'true');
});
