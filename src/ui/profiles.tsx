// Profile switcher (header button): each profile with its status; open another one. Profiles are managed in Settings.
import { useEffect, useState } from 'preact/hooks';
import { state, switchProfile, activeSegment, activityById, profileStatus, type ProfileStatus } from '../state.ts';
import { slotColor } from '../theme.ts';
import { fmtHM, fmtDayShort } from './util.ts';
import { openModal, useAppState } from './hooks.tsx';
import { t, tx } from '../i18n.ts';

export const openProfilePicker = (onSettings: (section?: string) => void) =>
  openModal((close) => <ProfilePicker close={close} onSettings={onSettings} />, { size: 'profiles' });

const initial = (name: string) => name.trim().charAt(0).toUpperCase();

function ProfilePicker({ close, onSettings }: { close: () => void; onSettings: (section?: string) => void }) {
  useAppState();
  const [status, setStatus] = useState<Record<string, ProfileStatus>>({});
  useEffect(() => {
    const now = Date.now();
    Promise.all(state.profiles.map(async (p) => [p.id, await profileStatus(p.id, now)] as const)).then((list) => setStatus(Object.fromEntries(list)));
  }, []);
  const open = activeSegment();
  const running = open && activityById(open.activityId);
  return (
    <div class="dialog-body">
      <h2 class="dialog-title">{t('profiles.switch')}</h2>
      {open && (
        <p class="notice">
          <span class="dot" style={{ background: running ? slotColor(running.colorSlot) : 'var(--muted)' }} />
          <span>{tx('profiles.runningNote', { strong: <strong>{t('profiles.runningIn', { name: running?.name ?? t('profiles.anActivity'), profile: state.profile.name })}</strong> })}</span>
        </p>
      )}
      <div class="profile-list">
        {state.profiles.map((p) => {
          const current = p.id === state.profile.id;
          const st = status[p.id];
          const sub = !st ? '…'
            : st.running ? t('profiles.statusRunning', { name: st.running.name, time: fmtHM(st.todayMs) })
            : st.lastUsed !== null ? t('profiles.statusIdle', { date: fmtDayShort(st.lastUsed) })
            : t('profiles.statusNew');
          return (
            <button
              key={p.id} class={`profile-row${current ? ' current' : ''}`} aria-current={current ? 'true' : undefined}
              onClick={async () => {
                close();
                await switchProfile(p.id);
              }}
            >
              <span class="initial">{initial(p.name)}</span>
              <span class="profile-text">
                <span class="profile-name">{p.name}</span>
                <span class="profile-sub"><span class="dot" style={{ background: st?.running ? slotColor(st.running.colorSlot) : 'var(--line-2)' }} />{sub}</span>
              </span>
              <span class={`profile-tag${current ? '' : ' accent'}`}>{t(current ? 'profiles.open' : 'profiles.switchTo')}</span>
            </button>
          );
        })}
      </div>
      <button class="lnk lnk-muted dialog-link" onClick={() => {
        close();
        onSettings('profiles');
      }}>{t('profiles.manage')}</button>
    </div>
  );
}
