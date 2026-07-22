const launchWeapons = [
  { name: '狂徒', count: 42 },
  { name: '幻影', count: 36 },
  { name: '正义', count: 24 },
];

export default function App() {
  return (
    <main className="app-shell">
      <h1>皮肤之巅</h1>
      <p>选择武器，即将开启皮肤锦标赛。</p>
      <div className="weapon-launches" aria-label="武器选择">
        {launchWeapons.map((weapon) => (
          <button key={weapon.name} type="button" disabled>
            {weapon.name} {weapon.count}
          </button>
        ))}
      </div>
    </main>
  );
}
