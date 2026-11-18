import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UpdateBar } from './UpdateBar';
import { _resetUpdates, useUpdate } from '../update';

afterEach(() => {
  cleanup();
  _resetUpdates();
});

describe('UpdateBar (app-update-prompt 2.1)', () => {
  it('renders only while an update is waiting; Reload applies it', () => {
    const fn = vi.fn(async () => {});
    _resetUpdates(fn);
    render(
      <MemoryRouter>
        <UpdateBar />
      </MemoryRouter>,
    );
    expect(screen.queryByText('A new version is available')).toBeNull();
    act(() => useUpdate.setState({ waiting: true }));
    expect(screen.getByRole('status').textContent).toContain('A new version is available');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(fn).toHaveBeenCalledWith(true);
  });
});
