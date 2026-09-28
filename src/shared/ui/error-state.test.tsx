import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from './error-state';

describe('ErrorState', () => {
  it('다시 시도를 누르면 onRetry 를 한 번 부른다', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="실패" onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('다시 시도 중이면 버튼을 aria-disabled 로 막고 문구를 바꾸며, 눌러도 onRetry 를 부르지 않는다', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="실패" onRetry={onRetry} retrying />);

    const button = screen.getByRole('button', { name: '다시 불러오는 중…' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // 포커스를 잃지 않게 disabled 는 쓰지 않는다.
    expect(button).toBeEnabled();
    await userEvent.click(button);
    await userEvent.dblClick(button);
    expect(onRetry).not.toHaveBeenCalled();
    // 오류 문구는 그대로 둔다. 알림은 쓰는 쪽의 live 영역이 맡으므로 live 역할이 없다.
    expect(screen.getByText('실패')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
