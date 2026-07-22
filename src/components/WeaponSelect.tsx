import type { WeaponId } from '../domain/types';

interface WeaponOption {
  readonly id: WeaponId;
  readonly label: string;
  readonly count: number;
}

interface WeaponSelectProps {
  readonly weapons: readonly WeaponOption[];
  readonly onSelect: (weapon: WeaponId) => void;
}

export function WeaponSelect({ weapons, onSelect }: WeaponSelectProps) {
  return (
    <main className="app-shell home-screen">
      <h1>皮肤之巅</h1>
      <p>选择武器，开启你的皮肤锦标赛。</p>
      <div className="weapon-launches" aria-label="武器选择">
        {weapons.map((weapon) => (
          <button key={weapon.id} type="button" onClick={() => onSelect(weapon.id)}>
            {weapon.label} · {weapon.count} 款
          </button>
        ))}
      </div>
    </main>
  );
}
