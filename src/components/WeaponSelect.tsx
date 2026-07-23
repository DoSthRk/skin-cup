import type { WeaponId } from '../domain/types';

interface WeaponOption {
  readonly id: WeaponId;
  readonly label: string;
  readonly count: number;
  readonly artwork: {
    readonly src: string;
    readonly skinName: string;
  };
}

interface WeaponSelectProps {
  readonly weapons: readonly WeaponOption[];
  readonly onSelect: (weapon: WeaponId) => void;
}

export function WeaponSelect({ weapons, onSelect }: WeaponSelectProps) {
  return (
    <main className="app-shell home-screen">
      <header className="home-brand">
        <img
          className="home-brand__mark"
          src="/brand/valorant-cup-emblem.png"
          alt="VALORANT-CUP 赛事标志"
        />
        <h1>VALORANT-CUP</h1>
        <p className="home-brand__subtitle">决战皮肤之巅</p>
      </header>
      <p className="home-screen__intro">选择武器，开启你的皮肤锦标赛。</p>
      <div className="weapon-launches" aria-label="武器选择">
        {weapons.map((weapon) => (
          <button key={weapon.id} type="button" onClick={() => onSelect(weapon.id)}>
            <span className="weapon-launch__copy">
              <strong>{weapon.label}</strong>
              <span>{weapon.count} 款特效皮肤</span>
            </span>
            <img
              className="weapon-launch__skin"
              src={weapon.artwork.src}
              alt={`${weapon.artwork.skinName} 代表皮肤`}
            />
          </button>
        ))}
      </div>
    </main>
  );
}
