import React from 'react'
import { CloudRain, Wind, Thermometer } from 'lucide-react'
import type { TeeTimeWeather, WeatherThresholds } from '@/components/dashboard/types'
import { DEFAULT_WEATHER_THRESHOLDS } from '@/components/dashboard/types'

interface WeatherMetricsProps {
  weather?: TeeTimeWeather
  thresholds?: WeatherThresholds
}

function toneClass(level: 'good' | 'bad' | 'neutral'): string {
  if (level === 'good') return 'text-green-600 font-semibold'
  if (level === 'bad') return 'text-red-600 font-semibold'
  return 'text-gray-500'
}

function rainTone(value: number, thresholds: WeatherThresholds): 'good' | 'bad' | 'neutral' {
  if (value < thresholds.rainGoodMax) return 'good'
  if (value > thresholds.rainBadMin) return 'bad'
  return 'neutral'
}

function windTone(value: number, thresholds: WeatherThresholds): 'good' | 'bad' | 'neutral' {
  if (value < thresholds.windGoodMax) return 'good'
  if (value > thresholds.windBadMin) return 'bad'
  return 'neutral'
}

function tempTone(value: number, thresholds: WeatherThresholds): 'good' | 'bad' | 'neutral' {
  if (value < thresholds.tempBadLow || value > thresholds.tempBadHigh) return 'bad'
  if (value >= thresholds.tempGoodMin && value <= thresholds.tempGoodMax) return 'good'
  return 'neutral'
}

const WeatherMetrics: React.FC<WeatherMetricsProps> = ({ weather, thresholds = DEFAULT_WEATHER_THRESHOLDS }) => {
  if (!weather) return <span className="text-gray-500">—</span>

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {weather.precipitationProbabilityPct !== null && (
        <span className={`inline-flex items-center gap-0.5 ${toneClass(rainTone(weather.precipitationProbabilityPct, thresholds))}`}>
          <CloudRain className="h-3 w-3" />
          {Math.round(weather.precipitationProbabilityPct)}%
        </span>
      )}
      {weather.windSpeedMph !== null && (
        <span className={`inline-flex items-center gap-0.5 ${toneClass(windTone(weather.windSpeedMph, thresholds))}`}>
          <Wind className="h-3 w-3" />
          {Math.round(weather.windSpeedMph)}
        </span>
      )}
      {weather.temperatureF !== null && (
        <span className={`inline-flex items-center gap-0.5 ${toneClass(tempTone(weather.temperatureF, thresholds))}`}>
          <Thermometer className="h-3 w-3" />
          {Math.round(weather.temperatureF)}F
        </span>
      )}
    </span>
  )
}

export default WeatherMetrics
