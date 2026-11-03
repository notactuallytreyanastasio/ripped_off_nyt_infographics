/**
 * ripped_off_nyt_infographics: sticky scrollytelling, sourced facts and
 * numbered citations, and a restrained D3 chart kit for long-form graphics
 * stories. Styles: import 'ripped-off-nyt-infographics/styles.css'.
 */
export * from './types';
export { h } from './core/dom';
export { activeStep, stepProgress, observeSteps } from './core/scroll';
export type { StepEvent, ObserveOptions } from './core/scroll';
export { createScrolly } from './scrolly';
export type { Scrolly, ScrollyOptions } from './scrolly';
export { collectSources, createCitations, fact } from './sources';
export type { Citations } from './sources';
export { para, prose, steps, sourceLine, drawer, dataTable } from './copy';
export type { Seg, Para, CopyStep, Column, TableSpec } from './copy';
export { mountStory, separateAdjacentCitations } from './story';
export type { Part, StoryConfig } from './story';
export * from './kit';
