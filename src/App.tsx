import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ChangeEvent, FormEvent, MouseEvent } from 'react'
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
  note: string
}

type VideoItem = {
  id: string
  videoId: string
  source: string
}

const DEFAULT_VIDEO_ID = 'M7lc1UVf-VE'
const DEFAULT_VIDEO_URL = `https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}`
const MIN_GRID_SIZE = 1
const MAX_GRID_SIZE = 12
const PORTRAIT_ASPECT_RATIO = '177.78%'

const DEFAULT_FEED: Array<Omit<VideoItem, 'id'>> = [
  { videoId: DEFAULT_VIDEO_ID, source: DEFAULT_VIDEO_URL },
  {
    videoId: 'aqz-KE-bpKQ',
    source: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    videoId: '5qap5aO4i9A',
    source: 'https://www.youtube.com/watch?v=5qap5aO4i9A',
  },
]

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
  const [videos, setVideos] = useState<VideoItem[]>(() =>
    DEFAULT_FEED.map((video, index) => ({
      ...video,
      id: `default-${index + 1}`,
    })),
  )
  const [rows, setRows] = useState(4)
  const [columns, setColumns] = useState(6)
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [videoInput, setVideoInput] = useState('')
  const [videoError, setVideoError] = useState<string | null>(null)
  const [pointsByVideo, setPointsByVideo] = useState<Record<string, PointOfInterest[]>>({})
  const [timeState, setTimeState] = useState<
    Record<string, { currentTime: number; duration: number }>
  >({})
  const [readyMap, setReadyMap] = useState<Record<string, boolean>>({})
  const [copyFeedback, setCopyFeedback] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [inlineEditors, setInlineEditors] = useState<Record<string, number | null>>({})
  const [activeVideoId, setActiveVideoId] = useState(() =>
    DEFAULT_FEED.at(0)?.videoId ?? '',
  )

  const playersRef = useRef<Record<string, YouTubePlayer | null>>({})
  const overlayRefs = useRef<Record<string, HTMLDivElement | null>>({})
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

  const handlePlayerReady = useCallback(
    (videoId: string) => (event: YouTubeEvent) => {
      playersRef.current[videoId] = event.target
      setReadyMap((previous) => ({ ...previous, [videoId]: true }))
    },
    [],
  )

  useEffect(() => {
    let frameId: number

    const updateTimes = () => {
      setTimeState((previous) => {
        let changed = false
        const next: Record<string, { currentTime: number; duration: number }> = {}

        videos.forEach((video) => {
          const player = playersRef.current[video.videoId]
          const existing = previous[video.videoId] ?? { currentTime: 0, duration: 0 }

          if (player) {
            const newTime = player.getCurrentTime?.() ?? 0
            const newDuration = player.getDuration?.() ?? 0

            if (
              Math.abs(existing.currentTime - newTime) > 0.02 ||
              Math.abs(existing.duration - newDuration) > 0.1
            ) {
              next[video.videoId] = {
                currentTime: newTime,
                duration: newDuration,
              }
              changed = true
            } else {
              next[video.videoId] = existing
            }
          } else {
            next[video.videoId] = existing
          }
        })

        if (!changed) {
          const previousKeys = Object.keys(previous)
          if (previousKeys.length !== videos.length) {
            changed = true
          } else {
            for (const key of previousKeys) {
              if (!next[key]) {
                changed = true
                break
              }
            }
          }
        }

        return changed ? next : previous
      })

      frameId = requestAnimationFrame(updateTimes)
    }

    frameId = requestAnimationFrame(updateTimes)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [videos])

  useEffect(() => {
    setCopyFeedback('')
  }, [activeVideoId])

  useEffect(() => {
    if (activeVideoId && !videos.some((video) => video.videoId === activeVideoId)) {
      setActiveVideoId(videos.at(0)?.videoId ?? '')
    }
  }, [videos, activeVideoId])

  const handleDrawerClose = () => {
    setIsDrawerOpen(false)
  }

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true)
  }

  const openInlineComposer = useCallback((videoId: string, pointId: number) => {
    setInlineEditors((previous) => ({
      ...previous,
      [videoId]: pointId,
    }))
    setActiveVideoId(videoId)
    setCopyFeedback('')
  }, [])

  const closeInlineComposer = useCallback((videoId: string) => {
    setInlineEditors((previous) => ({
      ...previous,
      [videoId]: null,
    }))
  }, [])

  const handlePointActivate = useCallback(
    (videoId: string, pointId: number, { seek = false }: { seek?: boolean } = {}) => {
      if (seek) {
        const target = (pointsByVideo[videoId] ?? []).find((point) => point.id === pointId)
        const player = playersRef.current[videoId]
        if (player && target) {
          player.seekTo?.(target.time, true)
        }
      }

      openInlineComposer(videoId, pointId)
    },
    [openInlineComposer, pointsByVideo],
  )

  const handleAddVideo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = extractVideoId(videoInput)
    if (!id) {
      setVideoError('Enter a valid YouTube URL or 11-character video ID.')
      return
    }

    if (videos.some((video) => video.videoId === id)) {
      setVideoError('That video is already in the feed.')
      return
    }

    setVideos((previous) => [
      ...previous,
      {
        id: `video-${Date.now()}`,
        videoId: id,
        source: videoInput.trim(),
      },
    ])
    setVideoInput('')
    setVideoError(null)
    setActiveVideoId(id)
  }

  const handleRemoveVideo = (videoId: string) => {
    setVideos((previous) => previous.filter((video) => video.videoId !== videoId))
    setPointsByVideo((previous) => {
      const { [videoId]: _removed, ...rest } = previous
      return rest
    })
    setTimeState((previous) => {
      const { [videoId]: _removed, ...rest } = previous
      return rest
    })
    setReadyMap((previous) => {
      const { [videoId]: _removed, ...rest } = previous
      return rest
    })
    delete playersRef.current[videoId]
    delete overlayRefs.current[videoId]

    setInlineEditors((previous) => {
      const { [videoId]: _removed, ...rest } = previous
      return rest
    })

    setActiveVideoId((current) => {
      if (current === videoId) {
        const next = videos.filter((video) => video.videoId !== videoId)
        return next.at(0)?.videoId ?? ''
      }
      return current
    })
  }

  const handleDimensionChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
  ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number.parseInt(event.target.value, 10)
      if (Number.isNaN(value)) {
        return
      }

      const clamped = Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, value))
      setter(clamped)
    }

  const toggleGridVisibility = () => {
    setIsGridVisible((value) => !value)
  }

  const recordPoint = useCallback(
    (videoId: string, rowIndex: number, columnIndex: number) =>
      (event: MouseEvent<HTMLButtonElement>) => {
        const player = playersRef.current[videoId]
        if (!player || !readyMap[videoId]) {
          return
        }

        const currentTime = player.getCurrentTime?.() ?? 0
        const overlayRect = overlayRefs.current[videoId]?.getBoundingClientRect()
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

        setPointsByVideo((previous) => {
          const nextPoints = [
            ...(previous[videoId] ?? []),
            newPoint,
          ].sort((a, b) => a.time - b.time)

          return {
            ...previous,
            [videoId]: nextPoints,
          }
        })

        openInlineComposer(videoId, newPoint.id)
      },
    [columns, rows, readyMap, openInlineComposer],
  )

  const handleQuickNote = useCallback(
    (videoId: string) => {
      const player = playersRef.current[videoId]
      if (!player || !readyMap[videoId]) {
        return
      }

      const currentTime = player.getCurrentTime?.() ?? 0
      idCounter.current += 1
      const centerRow = Math.ceil(rows / 2)
      const centerColumn = Math.ceil(columns / 2)
      const newPoint: PointOfInterest = {
        id: idCounter.current,
        time: currentTime,
        row: centerRow,
        column: centerColumn,
        xPercent: 50,
        yPercent: 50,
        note: '',
      }

      setPointsByVideo((previous) => {
        const nextPoints = [
          ...(previous[videoId] ?? []),
          newPoint,
        ].sort((a, b) => a.time - b.time)

        return {
          ...previous,
          [videoId]: nextPoints,
        }
      })

      openInlineComposer(videoId, newPoint.id)
    },
    [openInlineComposer, readyMap, rows, columns],
  )

  const removePoint = (videoId: string, id: number) => {
    setPointsByVideo((previous) => {
      const next = (previous[videoId] ?? []).filter((point) => point.id !== id)
      return {
        ...previous,
        [videoId]: next,
      }
    })
    setInlineEditors((previous) =>
      previous[videoId] === id
        ? {
            ...previous,
            [videoId]: null,
          }
        : previous,
    )
    setCopyFeedback('')
  }

  const clearPoints = (videoId: string) => {
    setPointsByVideo((previous) => ({
      ...previous,
      [videoId]: [],
    }))
    setInlineEditors((previous) =>
      previous[videoId]
        ? {
            ...previous,
            [videoId]: null,
          }
        : previous,
    )
    setCopyFeedback('')
  }

  const handleCopy = async (videoId: string) => {
    const points = pointsByVideo[videoId] ?? []
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

  const updateNote = (videoId: string, pointId: number, note: string) => {
    setPointsByVideo((previous) => {
      const updated = (previous[videoId] ?? []).map((point) =>
        point.id === pointId
          ? {
              ...point,
              note,
            }
          : point,
      )

      return {
        ...previous,
        [videoId]: updated,
      }
    })
    setCopyFeedback('')
  }

  useEffect(() => {
    setInlineEditors((previous) => {
      let changed = false
      const next = { ...previous }

      for (const videoId of Object.keys(previous)) {
        const activeId = previous[videoId]
        if (activeId == null) {
          continue
        }

        const hasPoint = (pointsByVideo[videoId] ?? []).some((point) => point.id === activeId)
        if (!hasPoint) {
          next[videoId] = null
          changed = true
        }
      }

      return changed ? next : previous
    })
  }, [pointsByVideo])

  const activeVideo = videos.find((video) => video.videoId === activeVideoId) ?? null
  const activePoints = activeVideo ? pointsByVideo[activeVideo.videoId] ?? [] : []

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__heading">
          <h1>Vertical Video Grid Feed</h1>
          <p className="app__subtitle">
            Scroll through a TikTok-style feed while capturing spatial notes on each video.
          </p>
        </div>
        <button type="button" className="button primary" onClick={handleDrawerOpen}>
          Open controls
        </button>
      </header>

      <main className="feed" role="list">
        {videos.length ? (
          videos.map((video) => {
            const videoPoints = pointsByVideo[video.videoId] ?? []
            const timeInfo = timeState[video.videoId] ?? { currentTime: 0, duration: 0 }
            const editingPointId = inlineEditors[video.videoId] ?? null
            const editingPoint =
              editingPointId != null
                ? videoPoints.find((point) => point.id === editingPointId) ?? null
                : null

            let displayedPoints = videoPoints.filter(
              (point) => Math.abs(point.time - timeInfo.currentTime) <= 0.75,
            )
            if (
              editingPoint &&
              !displayedPoints.some((point) => point.id === editingPoint.id)
            ) {
              displayedPoints = [...displayedPoints, editingPoint]
            }
            const timelineMarkers = timeInfo.duration
              ? videoPoints.map((point) => ({
                  id: point.id,
                  left: (point.time / timeInfo.duration) * 100,
                  isActive: displayedPoints.some((active) => active.id === point.id),
                  isEditing: editingPointId === point.id,
                  label: formatTimecode(point.time),
                }))
              : []
            const progressPercent = timeInfo.duration
              ? Math.min(100, Math.max(0, (timeInfo.currentTime / timeInfo.duration) * 100))
              : 0

            return (
              <section
                key={video.id}
                className={`feed-card${
                  activeVideoId === video.videoId ? ' feed-card--active' : ''
                }`}
                role="listitem"
                aria-label={`Video ${video.videoId}`}
              >
                <div
                  className="feed-card__inner"
                  onClick={() => setActiveVideoId(video.videoId)}
                  role="presentation"
                >
                  <div className="player-shell">
                    <div className="player-frame" style={{ paddingTop: PORTRAIT_ASPECT_RATIO }}>
                      <YouTube
                        videoId={video.videoId}
                        opts={youTubeOptions}
                        onReady={handlePlayerReady(video.videoId)}
                        className="player-frame__video"
                        iframeClassName="player-frame__video"
                      />
                    </div>
                    <div
                      ref={(node) => {
                        overlayRefs.current[video.videoId] = node
                      }}
                      className={`grid-overlay${isGridVisible ? ' is-visible' : ''}`}
                      style={{
                        gridTemplateRows: `repeat(${rows}, 1fr)`,
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                      }}
                      data-ready={readyMap[video.videoId] ? 'true' : 'false'}
                    >
                      {isGridVisible
                        ? Array.from({ length: rows * columns }, (_, index) => {
                            const rowIndex = Math.floor(index / columns)
                            const columnIndex = index % columns
                            return (
                              <button
                                key={`${video.videoId}-${rowIndex}-${columnIndex}`}
                                type="button"
                                className="grid-cell"
                                onClick={recordPoint(video.videoId, rowIndex, columnIndex)}
                                aria-label={`Mark row ${rowIndex + 1}, column ${
                                  columnIndex + 1
                                }`}
                              />
                            )
                          })
                        : null}
                      {displayedPoints.map((point) => (
                        <button
                          key={`marker-${point.id}`}
                          type="button"
                          className={`poi-marker${
                            editingPointId === point.id ? ' poi-marker--editing' : ''
                          }`}
                          style={{
                            left: `${point.xPercent}%`,
                            top: `${point.yPercent}%`,
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            handlePointActivate(video.videoId, point.id)
                          }}
                          aria-label={`Edit note at ${formatTimecode(point.time)}`}
                        >
                          <span className="sr-only">
                            Note at {formatTimecode(point.time)} located in row {point.row}, column{' '}
                            {point.column}
                          </span>
                          <span aria-hidden="true" className="poi-marker__dot" />
                          <div className="poi-callout">
                            <span className="poi-callout__time">
                              {formatTimecode(point.time)}
                            </span>
                            <span className="poi-callout__note">{point.note}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {editingPoint ? (
                    <div className="inline-composer" role="dialog" aria-label="Inline annotation editor">
                      <div className="inline-composer__header">
                        <span className="inline-composer__badge">Live note</span>
                        <button
                          type="button"
                          className="inline-composer__close"
                          onClick={() => closeInlineComposer(video.videoId)}
                        >
                          Done
                        </button>
                      </div>
                      <div className="inline-composer__meta">
                        <span className="inline-composer__time">
                          Captured {formatTimecode(editingPoint.time)}
                        </span>
                        <span className="inline-composer__grid">
                          Row {editingPoint.row} · Col {editingPoint.column}
                        </span>
                      </div>
                      <div className="inline-composer__live">
                        <span className="inline-composer__pulse" aria-hidden="true" />
                        <span className="inline-composer__live-label">
                          Playing {formatTimecode(timeInfo.currentTime)}
                        </span>
                      </div>
                      <label className="inline-composer__label">
                        <span className="sr-only">Update note text</span>
                        <textarea
                          className="inline-composer__input"
                          value={editingPoint.note}
                          onChange={(event) =>
                            updateNote(video.videoId, editingPoint.id, event.target.value)
                          }
                          placeholder="Jot a thought while the video keeps rolling..."
                          rows={3}
                        />
                      </label>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-composer__cta"
                      onClick={() => handleQuickNote(video.videoId)}
                      disabled={!readyMap[video.videoId]}
                    >
                      <span aria-hidden="true">✦</span> Quick note
                    </button>
                  )}
                  {timeInfo.duration ? (
                    <div className="timeline" aria-hidden="true">
                      <div className="timeline__track">
                        <div
                          className="timeline__progress"
                          style={{ width: `${progressPercent}%` }}
                        />
                        {timelineMarkers.map((marker) => (
                          <button
                            key={`marker-${marker.id}`}
                            type="button"
                            className={`timeline__marker${
                              marker.isActive ? ' timeline__marker--active' : ''
                            }${marker.isEditing ? ' timeline__marker--editing' : ''}`}
                            style={{ left: `${marker.left}%` }}
                            onClick={() => handlePointActivate(video.videoId, marker.id, { seek: true })}
                            aria-label={`Jump to note at ${marker.label}`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!readyMap[video.videoId] ? (
                    <p className="helper helper--muted">
                      Loading player… Tap once the grid appears.
                    </p>
                  ) : null}
                </div>
              </section>
            )
          })
        ) : (
          <div className="feed__empty">
            <p>No videos yet. Open the controls to add your first clip.</p>
          </div>
        )}
      </main>

      <div className={`drawer${isDrawerOpen ? ' drawer--open' : ''}`} aria-hidden={!isDrawerOpen}>
        <div className="drawer__scrim" onClick={handleDrawerClose} role="presentation" />
        <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Controls">
          <header className="drawer__header">
            <div>
              <h2>Feed controls</h2>
              <p className="drawer__subtitle">
                Manage videos, adjust the capture grid, and review your annotations.
              </p>
            </div>
            <button type="button" className="button" onClick={handleDrawerClose}>
              Close
            </button>
          </header>

          <div className="drawer__content">
            <section className="panel-section">
              <h3 className="panel__title">Add a video</h3>
              <form className="video-form" onSubmit={handleAddVideo}>
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
                    Add to feed
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setVideoInput('')
                      setVideoError(null)
                    }}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>

            <section className="panel-section">
              <h3 className="panel__title">Feed videos</h3>
              {videos.length ? (
                <ul className="video-list">
                  {videos.map((video) => (
                    <li key={`drawer-${video.id}`} className="video-list__item">
                      <button
                        type="button"
                        className={
                          activeVideoId === video.videoId
                            ? 'video-list__select video-list__select--active'
                            : 'video-list__select'
                        }
                        onClick={() => setActiveVideoId(video.videoId)}
                      >
                        {video.videoId}
                      </button>
                      <button
                        type="button"
                        className="video-list__remove"
                        onClick={() => handleRemoveVideo(video.videoId)}
                        aria-label={`Remove video ${video.videoId}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="helper helper--muted">
                  Your feed is empty. Add a video to get started.
                </p>
              )}
            </section>

            <section className="panel-section">
              <h3 className="panel__title">Grid settings</h3>
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
                <button type="button" className="button" onClick={toggleGridVisibility}>
                  {isGridVisible ? 'Hide grid' : 'Show grid'}
                </button>
              </div>
              {activeVideo ? (
                <p className="helper helper--muted">
                  Videos are optimized for vertical (9:16) playback.
                </p>
              ) : null}
            </section>

            <section className="panel-section">
              <div className="panel__header">
                <h3 className="panel__title">Captured points</h3>
                <div className="panel__actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => activeVideo && handleCopy(activeVideo.videoId)}
                    disabled={!activeVideo || !activePoints.length}
                  >
                    Copy JSON
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => activeVideo && clearPoints(activeVideo.videoId)}
                    disabled={!activeVideo || !activePoints.length}
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
              {activePoints.length ? (
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
                      {activePoints.map((point) => (
                        <tr key={point.id}>
                          <td>{formatTimecode(point.time)}</td>
                          <td>{point.row}</td>
                          <td>{point.column}</td>
                          <td>{point.xPercent.toFixed(1)}</td>
                          <td>{point.yPercent.toFixed(1)}</td>
                          <td className="points-table__note">
                            <input
                              type="text"
                              className="field__input field__input--inline"
                              value={point.note}
                              onChange={(event) =>
                                activeVideo &&
                                updateNote(activeVideo.videoId, point.id, event.target.value)
                              }
                              placeholder="Add a note"
                            />
                          </td>
                          <td className="points-table__actions">
                            <button
                              type="button"
                              className="button button--danger"
                              onClick={() =>
                                activeVideo && removePoint(activeVideo.videoId, point.id)
                              }
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
                  Select a video and tap the grid to capture new points.
                </p>
              )}
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
