import type { NewsItem } from "@shared/types"
import { useQuery } from "@tanstack/react-query"
import { useWindowSize } from "react-use"

interface CustomSource {
  id: string
  kind: "rss" | "telegram" | "custom"
  name: string
  title: string
  url: string
  color: string
}

interface CustomSourceResponse {
  sources?: CustomSource[]
}

export function useCustomSources() {
  return useQuery({
    queryKey: ["custom-sources"],
    queryFn: async (): Promise<CustomSource[]> => {
      const r: CustomSourceResponse = await myFetch("/custom-sources")
      return r?.sources || []
    },
    staleTime: 60_000,
  })
}

/** 自定义订阅卡片墙：展示管理面板里添加的 RSS/Telegram/自定义源 */
export function CustomSubs() {
  const { data: sources, isFetching } = useCustomSources()
  if (isFetching || !sources?.length) return null
  return (
    <section className="mt-10">
      <h2 className={$("text-xl font-bold mb-4 flex items-center gap-2")}>
        我的订阅
        <span className="text-sm font-normal op-50">（{sources.length} 个源）</span>
      </h2>
      <div className="grid w-full gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))" }}>
        {sources.map(src => <CustomCard key={src.id} src={src} />)}
      </div>
    </section>
  )
}

function CustomCard({ src }: { src: CustomSource }) {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["custom-source", src.id],
    queryFn: async (): Promise<{ items: NewsItem[]; updatedTime: number } | undefined> => {
      const r = await myFetch(`/s?id=${encodeURIComponent(src.id)}`)
      return r as any
    },
    staleTime: 60_000,
    placeholderData: prev => prev,
  })

  const { width } = useWindowSize()
  const items = data?.items || []

  return (
    <div className={$("flex flex-col h-500px rounded-2xl p-4 bg-primary/5 dark:bg-primary/10")}>
      <div className={$("flex justify-between mx-2 mt-0 mb-2 items-center")}>
        <div className="flex gap-2 items-center min-w-0">
          <a
            className={$("w-8 h-8 rounded-full bg-cover shrink-0")}
            target="_blank"
            rel="noopener noreferrer"
            href={src.url}
            title={src.url}
            style={{ backgroundImage: `url(/icons/default.png)` }}
          />
          <span className="flex flex-col min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-xl font-bold truncate">{src.name}</span>
              {src.title && <span className={$("text-sm color-primary bg-base op-80 bg-op-50! px-1 rounded shrink-0")}>{src.title}</span>}
            </span>
            <span className="text-xs op-70 truncate">
              <CustomUpdatedTime isError={isError} updatedTime={data?.updatedTime} />
            </span>
          </span>
        </div>
        <div className={$("flex gap-2 text-lg color-primary shrink-0")}>
          <button
            type="button"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refetch()}
          />
        </div>
      </div>

      <div className={$("h-full p-2 overflow-y-auto rounded-2xl bg-base bg-op-70! sprinkle-primary", isFetching && "animate-pulse")}>
        {items.length
          ? (
              <ol className="border-s border-neutral-400/50 flex flex-col ml-1">
                {items.map(item => (
                  <li key={item.id} className="flex flex-col">
                    <span className="flex items-center gap-1 text-neutral-400/50 ml--1px">
                      <span>-</span>
                      {(item.pubDate || item?.extra?.date) && (
                        <span className="text-xs text-neutral-400/80">
                          <CustomNewsTime date={(item.pubDate || item?.extra?.date)!} />
                        </span>
                      )}
                    </span>
                    <a
                      className={$(
                        "ml-2 px-1 hover:bg-neutral-400/10 rounded-md visited:(text-neutral-400/80)",
                        "cursor-pointer [&_*]:cursor-pointer transition-all",
                      )}
                      href={width < 768 ? item.mobileUrl || item.url : item.url}
                      title={item.extra?.hover}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ol>
            )
          : (
              <p className="text-sm op-50 p-2">{isError ? "获取失败" : "暂无内容"}</p>
            )}
      </div>
    </div>
  )
}

function CustomUpdatedTime({ isError, updatedTime }: { isError: boolean; updatedTime?: number }) {
  const relativeTime = useRelativeTime(updatedTime ?? "")
  if (relativeTime) return `${relativeTime}更新`
  if (isError) return "获取失败"
  return "加载中..."
}

function CustomNewsTime({ date }: { date: string | number }) {
  const relativeTime = useRelativeTime(date)
  return <>{relativeTime}</>
}
