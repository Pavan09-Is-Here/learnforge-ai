# Optimisers and Learning-Rate Schedules

## 1. Stochastic gradient descent

Stochastic gradient descent updates the parameters by stepping against the gradient of the
loss on a mini-batch. The step size is the learning rate. With a batch of 32 to 512
examples the gradient is a noisy estimate of the true gradient over the full dataset, and
that noise is not purely harmful: it acts as a regulariser and helps the optimiser escape
sharp, narrow minima that generalise badly. Plain SGD has one hyperparameter that matters
more than all the others combined, and that is the learning rate. Too large and the loss
oscillates or diverges; too small and training takes a number of steps nobody can afford.

Momentum adds a velocity term that accumulates past gradients with a decay factor, usually
0.9. The practical effect is that consistent gradient directions build up speed while
directions that keep flipping sign cancel out. On ill-conditioned loss surfaces, where the
curvature differs by orders of magnitude between directions, momentum is the difference
between training and not training.

## 2. Adam and the second-moment estimate

Adam keeps two running averages for every parameter: the first moment, an estimate of the
mean gradient, and the second moment, an estimate of the uncentred variance. The update
divides the first moment by the square root of the second moment, which rescales every
parameter's step by how noisy that parameter's gradient has been. Parameters with small,
consistent gradients get relatively larger steps; parameters with large, erratic gradients
get damped.

The decay rates are conventionally beta1 = 0.9 and beta2 = 0.999. The second number is the
important one here. A beta2 of 0.999 means the second-moment estimate has an effective
window of roughly one thousand steps, so for the first few hundred steps of training that
estimate is built from very few samples and is therefore extremely noisy. Dividing by the
square root of a noisy variance estimate produces occasional enormous steps, and an
enormous step early in training lands the parameters somewhere the optimiser cannot recover
from.

Bias correction rescales both moments by one minus the decay rate raised to the step count,
which fixes the systematic underestimate caused by initialising both accumulators at zero.
Bias correction does not fix the variance of the estimate. It corrects the expected value,
not the spread, which is why Adam still needs help in the opening phase of training.

## 3. Why warmup stabilises the opening phase

Learning-rate warmup ramps the learning rate linearly from near zero up to the target value
over the first several hundred to several thousand steps. The mechanism is simple: while the
second-moment estimate is still noisy, keep the effective step size small enough that a bad
rescaling cannot do real damage. By the time the learning rate reaches its target, the
second-moment estimate has seen enough gradients to be stable, and the division behaves
sensibly.

This is a variance problem, not a scale problem. Measured over the first four hundred
steps, the variance of the update direction under Adam without warmup is several times
higher than it is after the estimate has settled, and the loss curve shows it: runs without
warmup display large spikes in the first thousand steps, and in the experiment recorded in
these notes a transformer trained without warmup diverged at step 310 while the identical
run with a 500-step warmup converged normally. Warmup does not make the optimiser better in
steady state. It removes a failure mode that only exists at the beginning.

The right warmup length depends on batch size and model depth, and no single default is
correct across architectures. Larger batches need longer warmup because each step moves the
parameters further; deeper models need longer warmup because the gradient scale varies more
between layers.

## 4. Decay schedules after warmup

Once the learning rate has reached its target, it is usually decayed. Cosine decay reduces
the learning rate following a half cosine curve from the target down to near zero over the
remaining steps, and is the common default for transformer training because it spends most
of the run at a useful learning rate and anneals smoothly at the end. Step decay cuts the
learning rate by a fixed factor at chosen milestones, which is easier to reason about but
introduces a discontinuity the optimiser has to absorb. Inverse square root decay, scaling
the learning rate by one over the square root of the step count, was used in the original
transformer work and pairs naturally with warmup.

The interaction that matters: warmup and decay are not independent choices. A schedule that
warms up for ten percent of training and then decays with cosine behaves very differently
from one that warms up for one percent, because the area under the learning-rate curve is
what determines how far the parameters travel.

## 5. Weight decay and AdamW

Weight decay penalises large parameter values. In SGD, adding a weight-decay term to the
loss and shrinking the parameters directly are equivalent operations. In Adam they are not,
because the adaptive rescaling also rescales the penalty, so parameters with noisy
gradients get weakly regularised and parameters with clean gradients get strongly
regularised, which is the opposite of what anyone intends.

AdamW decouples the two: the weight-decay term is applied directly to the parameters,
outside the adaptive rescaling. This is a two-line change with a measurable effect on
generalisation, and it is why AdamW rather than Adam is the default in practically every
modern training recipe.

## 6. Gradient clipping

Gradient clipping rescales the gradient whenever its norm exceeds a threshold, commonly 1.0.
It is a safety mechanism rather than an optimisation improvement: it does not make good
steps better, it prevents one pathological batch from destroying a run. Clipping by global
norm, across all parameters at once, preserves the direction of the update and only changes
its magnitude, which is why it is preferred over clipping each parameter's gradient
independently.

Clipping and warmup address overlapping failure modes, and using both is standard. Clipping
handles rare large gradients at any point in training; warmup handles the systematically
unreliable rescaling at the start.
