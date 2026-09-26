/**
 * AdminTopbar — mobile menu button + breadcrumb on the left; notifications + account on the right.
 */

import { Menu } from 'lucide-react';
import Breadcrumb from './breadcrumb';
import NotificationDropdown from './notification-dropdown';
import UserMenu from './user-menu';

export default function AdminTopbar({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 flex h-[68px] flex-shrink-0 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-md lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open admin menu"
          className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-line bg-white text-ink lg:hidden"
        >
          <Menu size={18} />
        </button>
        <Breadcrumb />
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <NotificationDropdown />
        <UserMenu />
      </div>
    </header>
  );
}
