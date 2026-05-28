'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Brain, BookOpen, RotateCcw, CheckCircle, XCircle, ChevronLeft, ChevronRight, Sparkles, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactMarkdown from 'react-markdown';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function LearnPage() {
  const [activeTab, setActiveTab] = useState('quiz');
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [explanationLevel, setExplanationLevel] = useState('intermediate');

  const { data: quizData, isLoading: quizLoading, refetch: refetchQuiz } = useQuery({
    queryKey: ['quiz', quizDifficulty],
    queryFn: () => api.getQuiz({ difficulty: quizDifficulty, count: 5 }),
    enabled: activeTab === 'quiz',
  });

  const { data: flashcardsData, isLoading: flashcardsLoading, refetch: refetchFlashcards } = useQuery({
    queryKey: ['flashcards'],
    queryFn: () => api.getFlashcards({ count: 10 }),
    enabled: activeTab === 'flashcards',
  });

  const explainMutation = useMutation({
    mutationFn: (term: string) => api.explainTerm(term, explanationLevel),
  });

  const questions = quizData?.quiz?.questions || [];
  const flashcards = flashcardsData?.flashcards || [];

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    if (showResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: answerIndex }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (selectedAnswers[i] === q.correctAnswer) correct++;
    });
    return correct;
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowResults(false);
    refetchQuiz();
  };

  const toggleFlip = (index: number) => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      explainMutation.mutate(searchTerm.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Learn & Improve</h1>
        <p className="text-sm text-muted-foreground">
          AI-generated quizzes and flashcards based on your trading patterns
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quiz" className="gap-2">
            <Brain className="h-4 w-4" />
            Quiz
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Flashcards
          </TabsTrigger>
          <TabsTrigger value="explain" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Explainer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quiz" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Select value={quizDifficulty} onValueChange={setQuizDifficulty}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={resetQuiz}>
                <RotateCcw className="h-4 w-4 mr-2" />
                New Quiz
              </Button>
            </div>
            {questions.length > 0 && !showResults && (
              <span className="text-sm text-muted-foreground">
                Question {currentQuestion + 1} of {questions.length}
              </span>
            )}
          </div>

          {quizLoading ? (
            <Card className="border-border/50">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : questions.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Quiz Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Log more trades to generate personalized quizzes based on your patterns
                </p>
                <Button variant="outline" onClick={() => refetchQuiz()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : showResults ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Quiz Results</CardTitle>
                <CardDescription>
                  You scored {calculateScore()} out of {questions.length}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <div className={cn(
                    'text-4xl font-bold',
                    calculateScore() >= questions.length * 0.7 ? 'text-profit' : 'text-loss'
                  )}>
                    {Math.round((calculateScore() / questions.length) * 100)}%
                  </div>
                  <div>
                    <p className="font-medium">
                      {calculateScore() >= questions.length * 0.7 ? 'Great job!' : 'Keep learning!'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Review your answers below
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {questions.map((q, i) => (
                    <div key={i} className="p-4 rounded-lg border border-border/50">
                      <div className="flex items-start gap-2 mb-3">
                        {selectedAnswers[i] === q.correctAnswer ? (
                          <CheckCircle className="h-5 w-5 text-profit mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-loss mt-0.5" />
                        )}
                        <p className="font-medium">{q.question}</p>
                      </div>
                      <div className="ml-7 space-y-2">
                        {q.options.map((opt, j) => (
                          <div
                            key={j}
                            className={cn(
                              'p-2 rounded text-sm',
                              j === q.correctAnswer && 'bg-profit/20 text-profit',
                              j === selectedAnswers[i] && j !== q.correctAnswer && 'bg-loss/20 text-loss'
                            )}
                          >
                            {opt}
                          </div>
                        ))}
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={resetQuiz} className="w-full">
                  Take Another Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-6">
                <p className="text-lg font-medium mb-6">
                  {questions[currentQuestion]?.question}
                </p>
                <div className="space-y-3">
                  {questions[currentQuestion]?.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswerSelect(currentQuestion, i)}
                      className={cn(
                        'w-full p-4 text-left rounded-lg border transition-colors',
                        selectedAnswers[currentQuestion] === i
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:border-border hover:bg-muted/50'
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion((p) => Math.max(0, p - 1))}
                    disabled={currentQuestion === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  {currentQuestion === questions.length - 1 ? (
                    <Button
                      onClick={() => setShowResults(true)}
                      disabled={Object.keys(selectedAnswers).length < questions.length}
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentQuestion((p) => Math.min(questions.length - 1, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="flashcards" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => refetchFlashcards()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              New Cards
            </Button>
            {flashcards.length > 0 && (
              <span className="text-sm text-muted-foreground">
                Card {currentCard + 1} of {flashcards.length}
              </span>
            )}
          </div>

          {flashcardsLoading ? (
            <Card className="border-border/50">
              <CardContent className="p-12">
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ) : flashcards.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Flashcards Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Log more trades to generate personalized flashcards
                </p>
                <Button variant="outline" onClick={() => refetchFlashcards()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div
                onClick={() => toggleFlip(currentCard)}
                className="cursor-pointer perspective-1000"
              >
                <Card className={cn(
                  'border-border/50 transition-all duration-500 min-h-[250px] flex items-center justify-center',
                  flippedCards.has(currentCard) && 'bg-primary/5'
                )}>
                  <CardContent className="p-8 text-center">
                    {flippedCards.has(currentCard) ? (
                      <div>
                        <Badge variant="secondary" className="mb-4">Answer</Badge>
                        <p className="text-lg">{flashcards[currentCard]?.back}</p>
                      </div>
                    ) : (
                      <div>
                        <Badge variant="outline" className="mb-4">
                          {flashcards[currentCard]?.category}
                        </Badge>
                        <p className="text-xl font-medium">{flashcards[currentCard]?.front}</p>
                        <p className="text-sm text-muted-foreground mt-4">
                          Click to reveal answer
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentCard((p) => Math.max(0, p - 1));
                    setFlippedCards(new Set());
                  }}
                  disabled={currentCard === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => toggleFlip(currentCard)}
                >
                  Flip Card
                </Button>
                <Button
                  onClick={() => {
                    setCurrentCard((p) => Math.min(flashcards.length - 1, p + 1));
                    setFlippedCards(new Set());
                  }}
                  disabled={currentCard === flashcards.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <div className="flex justify-center gap-2 mt-4">
                {flashcards.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentCard(i);
                      setFlippedCards(new Set());
                    }}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      i === currentCard ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="explain" className="mt-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>AI Trading Term Explainer</CardTitle>
              <CardDescription>
                Enter any trading term or concept to get an AI-powered explanation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="e.g., Stop loss, FOMO, Risk-reward ratio..."
                    className="pl-10"
                  />
                </div>
                <Select value={explanationLevel} onValueChange={setExplanationLevel}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={explainMutation.isPending}>
                  {explainMutation.isPending ? 'Explaining...' : 'Explain'}
                </Button>
              </form>

              {explainMutation.data && (
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{explainMutation.data.term}</Badge>
                    <Badge variant="outline">{explainMutation.data.level}</Badge>
                  </div>
                  <div className="text-sm leading-relaxed markdown-content">
                    <ReactMarkdown>{explainMutation.data.explanation}</ReactMarkdown>
                  </div>
                  {explainMutation.data.examples && explainMutation.data.examples.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Examples:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {explainMutation.data.examples.map((ex, i) => (
                          <li key={i}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {explainMutation.data.relatedTerms && explainMutation.data.relatedTerms.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-xs text-muted-foreground">Related:</span>
                      {explainMutation.data.relatedTerms.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSearchTerm(term);
                            explainMutation.mutate(term);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {explainMutation.isError && (
                <div className="p-4 rounded-lg bg-loss/10 text-loss text-sm">
                  Failed to get explanation. Please try again.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
