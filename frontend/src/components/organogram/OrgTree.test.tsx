import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgTree, { typeLabel } from './OrgTree';

describe('OrgTree', () => {
  it('renders the root institute and its direct offices', () => {
    render(<OrgTree />);
    expect(screen.getByText('IIT Mandi')).toBeInTheDocument();
    // name and head designation can both render the same text
    expect(screen.getAllByText('Director').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Registrar').length).toBeGreaterThan(0);
  });

  it('collapses and expands a section', async () => {
    render(<OrgTree />);
    expect(screen.getByText('Library')).toBeInTheDocument();

    const academicsRow = screen.getByText('Academics').closest('li')!;
    const toggle = within(academicsRow).getAllByRole('button', { name: /collapse section/i })[0];
    await userEvent.click(toggle);
    expect(screen.queryByText('Library')).not.toBeInTheDocument();

    await userEvent.click(within(academicsRow).getAllByRole('button', { name: /expand section/i })[0]);
    expect(screen.getByText('Library')).toBeInTheDocument();
  });

  it('calls onActivate with the unit id when a unit is clicked', async () => {
    const onActivate = vi.fn();
    render(<OrgTree onActivate={onActivate} />);
    await userEvent.click(screen.getByText('Library'));
    expect(onActivate).toHaveBeenCalledWith('library');
  });

  it('filters the tree by query and keeps ancestors of matches', () => {
    render(<OrgTree query="librarian" />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Academics')).toBeInTheDocument(); // ancestor
    expect(screen.queryByText('Hostels')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    render(<OrgTree query="zzz-no-match-zzz" />);
    expect(screen.getByText(/no section matches/i)).toBeInTheDocument();
  });

  it('filters by unit type while keeping ancestors visible', () => {
    render(<OrgTree typeFilter={['FUNCTIONAL']} />);
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getAllByText('Registrar').length).toBeGreaterThan(0);
  });

  describe('selectable mode', () => {
    it('emits the selected id when a checkbox is toggled', async () => {
      const onSelectionChange = vi.fn();
      render(<OrgTree selectable selectedIds={[]} onSelectionChange={onSelectionChange} />);
      await userEvent.click(screen.getByRole('button', { name: 'Select Library' }));
      expect(onSelectionChange).toHaveBeenCalledWith(['library']);
    });

    it('deselects an already selected unit', async () => {
      const onSelectionChange = vi.fn();
      render(<OrgTree selectable selectedIds={['library']} onSelectionChange={onSelectionChange} />);
      const box = screen.getByRole('button', { name: 'Select Library' });
      expect(box).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(box);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('disables locked units (the institute root by default)', () => {
      render(<OrgTree selectable />);
      expect(
        screen.getByRole('button', { name: 'Select Indian Institute of Technology Mandi' }),
      ).toBeDisabled();
    });

    it('selects a whole subtree via the subtree button', async () => {
      const onSelectionChange = vi.fn();
      render(<OrgTree selectable onSelectionChange={onSelectionChange} />);
      const row = screen.getByText('Finance').closest('li')!;
      await userEvent.click(within(row).getAllByTitle(/select this section and everything under it/i)[0]);
      const ids = onSelectionChange.mock.calls[0][0] as string[];
      expect(ids).toEqual(expect.arrayContaining(['dean-finance', 'budget', 'accounts', 'stores-purchase']));
    });
  });

  describe('coverage badges', () => {
    it('shows officer count, missing-officer warning and pending requests', () => {
      render(
        <OrgTree
          coverage={{
            library: { officerIds: ['o1', 'o2'], pendingRequests: 3 },
            sports: { officerIds: [], pendingRequests: 0 },
          } as any}
        />,
      );
      expect(screen.getByTitle('2 nodal officers assigned')).toBeInTheDocument();
      expect(screen.getByTitle('3 pending data request(s)')).toBeInTheDocument();
      expect(screen.getAllByTitle('No nodal officer assigned').length).toBeGreaterThan(0);
    });
  });
});

describe('typeLabel', () => {
  it('maps unit types to display labels', () => {
    expect(typeLabel('ACADEMIC')).toBe('Academic');
    expect(typeLabel('FUNCTIONAL')).toBe('Functional');
  });
});
