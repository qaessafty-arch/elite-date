const TABLES = [
  {
    title: 'Tops, jackets and coats',
    note: 'Body measurements in centimetres. Measure the fullest part of your chest and around your natural waist.',
    head: ['Size', 'Chest', 'Waist', 'Sleeve'],
    rows: [
      ['XS', '82 to 87', '66 to 71', '79'],
      ['S', '88 to 93', '72 to 77', '81'],
      ['M', '94 to 99', '78 to 83', '83'],
      ['L', '100 to 106', '84 to 90', '85'],
      ['XL', '107 to 113', '91 to 97', '87'],
      ['XXL', '114 to 120', '98 to 104', '89'],
    ],
  },
  {
    title: 'Trousers and jeans',
    note: 'Sizes are waist in inches. Inside leg is 81 cm on all sizes and can be shortened.',
    head: ['Size', 'Waist (cm)', 'Hip (cm)'],
    rows: [
      ['24', '61 to 63', '86 to 88'],
      ['26', '66 to 68', '91 to 93'],
      ['28', '71 to 73', '96 to 98'],
      ['30', '76 to 78', '100 to 102'],
      ['32', '81 to 83', '104 to 106'],
      ['34', '86 to 88', '108 to 110'],
      ['36', '91 to 93', '112 to 114'],
    ],
  },
  {
    title: 'Shoes',
    note: 'European sizes. If you are between sizes, take the larger one.',
    head: ['EU', 'UK', 'US men', 'US women', 'Foot length (cm)'],
    rows: [
      ['39', '6', '7', '8.5', '24.6'],
      ['40', '6.5', '7.5', '9', '25.3'],
      ['41', '7.5', '8.5', '10', '26.0'],
      ['42', '8', '9', '10.5', '26.7'],
      ['43', '9', '10', '11.5', '27.3'],
      ['44', '9.5', '10.5', '12', '28.0'],
      ['45', '10.5', '11.5', '13', '28.6'],
    ],
  },
];

export function SizeGuideTables() {
  return (
    <div className="grid gap-10">
      {TABLES.map((t) => (
        <section key={t.title}>
          <h3 className="display display-sm">{t.title}</h3>
          <p className="small mt-1 text-mute">{t.note}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[22rem] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b border-ink">
                  {t.head.map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r[0]} className="border-b border-line">
                    {r.map((cell, i) =>
                      i === 0 ? (
                        <th key={i} scope="row" className="py-2 pr-4 font-semibold">
                          {cell}
                        </th>
                      ) : (
                        <td key={i} className="py-2 pr-4 tabular-nums text-mute">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
