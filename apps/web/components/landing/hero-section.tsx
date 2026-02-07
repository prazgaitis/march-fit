import Link from "next/link";
import { ArrowRight, Trophy, Users, Zap } from "lucide-react";

export function HeroSection() {
  return (
    <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Turn Fitness Into
            <span className="block text-accent">Competition</span>
          </h1>
          <p className="text-xl sm:text-2xl text-primary-foreground/80 mb-8 max-w-3xl mx-auto">
            Join fitness challenges, track your progress, and compete with friends.
            Connect your favorite apps and earn points for every workout.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="/sign-up"
              className="inline-flex items-center px-8 py-4 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg transition-colors group"
            >
              Join a Challenge
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#challenges"
              className="inline-flex items-center px-8 py-4 bg-transparent border-2 border-primary-foreground hover:bg-primary-foreground hover:text-primary text-primary-foreground font-semibold rounded-lg transition-colors"
            >
              Browse Challenges
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="bg-accent/20 p-4 rounded-full mb-4">
                <Trophy className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Compete & Win</h3>
              <p className="text-primary-foreground/70 text-sm">
                Climb the leaderboard and earn achievements for your fitness goals
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-accent/20 p-4 rounded-full mb-4">
                <Users className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Social Fitness</h3>
              <p className="text-primary-foreground/70 text-sm">
                Share your progress and stay motivated with friends and community
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="bg-accent/20 p-4 rounded-full mb-4">
                <Zap className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Auto-Sync</h3>
              <p className="text-primary-foreground/70 text-sm">
                Connect Strava, Apple Health, and more for automatic activity tracking
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}