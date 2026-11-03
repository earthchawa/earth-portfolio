export default function SplitWords({ text, delay = 0, step = 90 }) {
  return text.split(' ').map((word, i) => (
    <span key={i}>
      <span className="word-mask">
        <span style={{ transitionDelay: `${delay + i * step}ms` }}>{word}</span>
      </span>{' '}
    </span>
  ));
}
