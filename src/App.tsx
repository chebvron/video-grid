import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent, YouTubePlayer } from 'react-youtube'
import './App.css'

type PointOfInterest = {
  id: number
  time: number
  row: number
  column: number
  xPercent: number
  yPercent: number
  note?: string
}

const DEFAULT_VIDEO_ID = 'M7lc1UVf-VE'
const DEFAULT_VIDEO_URL = `https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}`
const MIN_GRID_SIZE = 1
const MAX_GRID_SIZE = 12

const extractVideoId = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed
  }

  try {
    const url = new URL(trimmed)
    if (url.hostname.includes('youtu.be')) {
      const potentialId = url.pathname.split('/').filter(Boolean).at(-1)
      if (potentialId && /^[\w-]{11}$/.test(potentialId)) {
        return potentialId
      }
    }

    if (url.hostname.includes('youtube.com')) {
      const searchId = url.searchParams.get('v')
      if (searchId && /^[\w-]{11}$/.test(searchId)) {
        return searchId
      }

      const pathSegments = url.pathname.split('/').filter(Boolean)
      const potentialId = pathSegments.at(-1)
      if (potentialId && /^[\w-]{11}$/.test(potentialId)) {
        return potentialId
      }
    }
  } catch (error) {
    // value was not a valid URL, ignore and fallthrough
  }

  const inlineMatch = value.match(/[\w-]{11}/)
  return inlineMatch ? inlineMatch[0] : null
}

const formatTimecode = (seconds: number): string => {
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainingSeconds = wholeSeconds % 60
  const milliseconds = Math.round((seconds - wholeSeconds) * 1000)

  const paddedSeconds = remainingSeconds.toString().padStart(2, '0')
  const paddedMilliseconds = milliseconds.toString().padStart(3, '0')

  return `${minutes}:${paddedSeconds}.${paddedMilliseconds}`
}

function App() {
  const [videoInput, setVideoInput] = useState(DEFAULT_VIDEO_URL)
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [rows, setRows] = useState(4)
  const [columns, setColumns] = useState(6)
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [points, setPoints] = useState<PointOfInterest[]>([])
  const [copyFeedback, setCopyFeedback] = useState<string>('')
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const idCounter = useRef(0)

  const youTubeOptions = useMemo(
    () => ({
      width: '100%',
      height: '100%',
      playerVars: {
        modestbranding: 1,
        rel: 0,
        controls: 1,
      },
    }),
    [],
  )

  const gridTemplateStyle = useMemo(
    () => ({
      gridTemplateRows: `repeat(${rows}, 1fr)`,
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
    }),
    [rows, columns],
  )

  const handlePlayerReady = (event: YouTubeEvent) => {
    playerRef.current = event.target
    setIsPlayerReady(true)
  }

  const handleVideoSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = extractVideoId(videoInput)
    if (!id) {
      setVideoError('Enter a valid YouTube URL or 11-character video ID.')
      return
    }

    setVideoId(id)
    setVideoError(null)
    setIsPlayerReady(false)
    setPoints([])
  }

  const handleDimensionChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
  ) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(event.target.value, 10)
      if (Number.isNaN(value)) {
        return
      }

      const clamped = Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, value))
      setter(clamped)
    }

  const recordPoint = useCallback(
    (rowIndex: number, columnIndex: number) =>
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!playerRef.current || !isPlayerReady) {
          return
        }

        const currentTime = playerRef.current.getCurrentTime?.() ?? 0
        const overlayRect = overlayRef.current?.getBoundingClientRect()
        const clickX = event.clientX
        const clickY = event.clientY

        let xPercent = ((columnIndex + 0.5) / columns) * 100
        let yPercent = ((rowIndex + 0.5) / rows) * 100

        if (overlayRect && overlayRect.width > 0 && overlayRect.height > 0) {
          xPercent = ((clickX - overlayRect.left) / overlayRect.width) * 100
          yPercent = ((clickY - overlayRect.top) / overlayRect.height) * 100
        }

        idCounter.current += 1
        const newPoint: PointOfInterest = {
          id: idCounter.current,
          time: currentTime,
          row: rowIndex + 1,
          column: columnIndex + 1,
          xPercent,
          yPercent,
          note: '',
        }

        setPoints((previous) =>
          [...previous, newPoint].sort((a, b) => a.time - b.time),
        )
        setCopyFeedback('')
      },
    [columns, rows, isPlayerReady],
  )

  const removePoint = (id: number) => {
    setPoints((previous) => previous.filter((point) => point.id !== id))
    setCopyFeedback('')
  }

  const clearPoints = () => {
    setPoints([])
    setCopyFeedback('')
  }

  const handleCopy = async () => {
    if (!points.length) {
      return
    }

    const payload = points.map(({ id, ...rest }) => ({ ...rest }))
    try {
      if (!navigator.clipboard) {
        setCopyFeedback('Clipboard access is not available in this browser.')
        return
      }

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      setCopyFeedback('Copied to clipboard!')
    } catch (error) {
      setCopyFeedback('Unable to access the clipboard in this environment.')
    }
  }

  const toggleGridVisibility = () => {
    setIsGridVisible((value) => !value)
  }

  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) {
      setCurrentTime(0)
      return
    }

    let animationFrame: number

    const updateCurrentTime = () => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime?.() ?? 0
        setCurrentTime(time)
      }

      animationFrame = window.requestAnimationFrame(updateCurrentTime)
    }

    animationFrame = window.requestAnimationFrame(updateCurrentTime)

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [isPlayerReady])

  const handleNoteChange = useCallback(
    (id: number) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setPoints((previous) =>
        previous.map((point) => (point.id === id ? { ...point, note: value } : point)),
      )
      setCopyFeedback('')
    },
    [],
  )

  const activePoints = useMemo(() => {
    const tolerance = 0.5
    return points.filter((point) => Math.abs(point.time - currentTime) <= tolerance)
  }, [points, currentTime])

  const activeNotes = useMemo(
    () => activePoints.filter((point) => point.note && point.note.trim()),
    [activePoints],
  )

  const gridCells = useMemo(() => {
    return Array.from({ length: rows * columns }, (_, index) => {
      const rowIndex = Math.floor(index / columns)
      const columnIndex = index % columns
      return (
        <button
          key={`${rowIndex}-${columnIndex}`}
          type="button"
          className="grid-cell"
          onClick={recordPoint(rowIndex, columnIndex)}
          aria-label={`Mark row ${rowIndex + 1}, column ${columnIndex + 1}`}
        />
      )
    })
  }, [rows, columns, recordPoint])

  return (
    <div className="app">
      <header className="app__header">
        <h1>Video Grid Annotator</h1>
        <p className="app__subtitle">
          Overlay a capture grid on top of any YouTube video and record points of
          interest with exact timestamps.
        </p>
      </header>

      <section className="panel">
        <h2 className="panel__title">Video source</h2>
        <form className="video-form" onSubmit={handleVideoSubmit}>
          <label className="field">
            <span className="field__label">YouTube URL or video ID</span>
            <input
              value={videoInput}
              onChange={(event) => setVideoInput(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={videoError ? 'field__input field__input--error' : 'field__input'}
              aria-invalid={videoError ? 'true' : 'false'}
            />
          </label>
          {videoError ? (
            <p className="field__error" role="alert">
              {videoError}
            </p>
          ) : null}
          <div className="video-form__actions">
            <button type="submit" className="button primary">
              Load video
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setVideoInput(DEFAULT_VIDEO_URL)
                setVideoId(DEFAULT_VIDEO_ID)
                setVideoError(null)
                setPoints([])
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="panel__title">Grid settings</h2>
        <div className="grid-settings">
          <label className="field compact">
            <span className="field__label">Rows</span>
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={rows}
              onChange={handleDimensionChange(setRows)}
              className="field__input"
            />
          </label>
          <label className="field compact">
            <span className="field__label">Columns</span>
            <input
              type="number"
              min={MIN_GRID_SIZE}
              max={MAX_GRID_SIZE}
              value={columns}
              onChange={handleDimensionChange(setColumns)}
              className="field__input"
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={toggleGridVisibility}
          >
            {isGridVisible ? 'Hide grid' : 'Show grid'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel__title">Annotate</h2>
        <div className="player-shell">
          <div className="player-frame">
            <YouTube
              videoId={videoId}
              opts={youTubeOptions}
              onReady={handlePlayerReady}
              className="player-frame__video"
              iframeClassName="player-frame__video"
            />
          </div>
          <div
            ref={overlayRef}
            className={`grid-overlay${isGridVisible ? ' is-visible' : ''}`}
            style={gridTemplateStyle}
            data-ready={isPlayerReady}
          >
            {isGridVisible ? gridCells : null}
            {activePoints.map((point) => (
              <div
                key={`marker-${point.id}`}
                className="poi-marker"
                style={{
                  left: `${point.xPercent}%`,
                  top: `${point.yPercent}%`,
                }}
                aria-hidden="true"
              />
            ))}
            {activeNotes.map((point) => (
              <div
                key={`note-${point.id}`}
                className="poi-note"
                style={{
                  left: `${point.xPercent}%`,
                  top: `${point.yPercent}%`,
                }}
                role="status"
              >
                <span className="poi-note__time">{formatTimecode(point.time)}</span>
                <span className="poi-note__content">{point.note}</span>
              </div>
            ))}
          </div>
        </div>
        {!isPlayerReady ? (
          <p className="helper helper--muted">
            Loading player… Click the grid once the video is ready.
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2 className="panel__title">Captured points</h2>
          <div className="panel__actions">
            <button
              type="button"
              className="button"
              onClick={handleCopy}
              disabled={!points.length}
            >
              Copy JSON
            </button>
            <button
              type="button"
              className="button"
              onClick={clearPoints}
              disabled={!points.length}
            >
              Clear list
            </button>
          </div>
        </div>
        {copyFeedback ? (
          <p className="helper" role="status">
            {copyFeedback}
          </p>
        ) : null}
        {points.length ? (
          <div className="points-table__wrapper">
            <table className="points-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Row</th>
                  <th scope="col">Column</th>
                  <th scope="col">X (%)</th>
                  <th scope="col">Y (%)</th>
                  <th scope="col">Note</th>
                  <th scope="col" className="points-table__actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.id}>
                    <td>{formatTimecode(point.time)}</td>
                    <td>{point.row}</td>
                    <td>{point.column}</td>
                    <td>{point.xPercent.toFixed(1)}</td>
                    <td>{point.yPercent.toFixed(1)}</td>
                    <td>
                      <textarea
                        value={point.note ?? ''}
                        onChange={handleNoteChange(point.id)}
                        placeholder="Add a note…"
                        className="points-table__note"
                        rows={2}
                      />
                    </td>
                    <td className="points-table__actions">
                      <button
                        type="button"
                        className="button button--danger"
                        onClick={() => removePoint(point.id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="helper helper--muted">
            Click anywhere on the grid to capture a point of interest.
          </p>
        )}
      </section>
    </div>
  )
}

export default App
